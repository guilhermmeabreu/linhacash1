import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { invalidateCacheByPrefix } from '@/lib/cache/memory-cache';
import { nbaMockProvider, type ApiSportsGame, type ApiSportsPlayer, type ApiSportsPlayerStat } from '@/lib/mock/nbaMock';

type SyncStatus = 'running' | 'success' | 'error' | 'skipped';

type SyncSummary = {
  status: SyncStatus;
  message: string;
  gamesSynced: number;
  teamsSynced: number;
  playersSynced: number;
  playerStatsSynced: number;
  errors: string[];
  startedAt: string;
  finishedAt: string;
  debug?: {
    requestId: string | null;
    routeSource: 'cron' | 'manual' | null;
    syncMode?: 'bootstrap' | 'daily';
    hasRunningSync: boolean | null;
    inProcessRunAlready: boolean;
    distributedLock: 'acquired' | 'locked' | 'unavailable' | null;
    playerTeamReconciled?: number;
  };
};

type RunNbaSyncOptions = {
  requestId?: string | null;
  routeSource?: 'cron' | 'manual' | null;
  syncMode?: 'bootstrap' | 'daily';
  bootstrapTeamIds?: number[];
};

type ApiSportsResponse<T> = { response?: T[] };

type SyncLogRecord = {
  id: number | string;
};

const BASE_URL = 'https://v2.nba.api-sports.io';
const RUNNING_STATUSES = new Set(['running', 'in_progress']);
const LOCK_WINDOW_MS = 15 * 60_000;
const SYNC_TIMEOUT_MS = 8 * 60_000;
const DATE_WINDOW_PAST_DAYS = 2;
const DATE_WINDOW_FUTURE_DAYS = 3;
const MOCK_MAX_TEAMS = 4;
const MOCK_MAX_PLAYERS_PER_TEAM = 6;
const MOCK_MAX_PLAYER_STATS = 12;
const DEFAULT_BOOTSTRAP_TEAM_IDS = [
  1, 2, 4, 5, 6, 7, 10, 11, 14, 15,
  16, 17, 20, 21, 24, 25, 26, 27, 28, 29,
];

type ApiProvider = {
  source: 'real' | 'mock';
  getGamesByDate: (date: string, signal: AbortSignal) => Promise<ApiSportsGame[]>;
  getGamesByTeamSeason: (teamId: number, season: number, signal: AbortSignal) => Promise<ApiSportsGame[]>;
  getPlayersByTeam: (teamId: number, season: number, signal: AbortSignal) => Promise<ApiSportsPlayer[]>;
  getPlayerStatistics: (playerId: number, season: number, signal: AbortSignal) => Promise<ApiSportsPlayerStat[]>;
  getPlayerStatisticsByGame: (gameId: number, season: number, signal: AbortSignal) => Promise<ApiSportsPlayerStat[]>;
  getTeamName?: (teamId: number) => string;
};

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Supabase service credentials are missing');
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMinutes(raw: string | null | undefined): number {
  if (!raw) return 0;
  const [minutes] = raw.split(':');
  return toNumber(minutes);
}

function resolveStatsSeason(defaultSeason: number): number {
  const raw = process.env.NBA_STATS_SEASON;
  if (!raw) return defaultSeason;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultSeason;
}

function parseTeamIds(raw: string | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function isLikelyFinishedGame(game: ApiSportsGame, now = new Date()): boolean {
  const status = (game.status?.long || '').toLowerCase();
  if (status.includes('finished') || status.includes('over') || status.includes('final')) return true;

  const start = game.date?.start;
  if (!start) return false;
  return new Date(start).getTime() <= now.getTime();
}

async function apiGet<T>(path: string, apiKey: string, signal: AbortSignal, retries = 2): Promise<ApiSportsResponse<T>> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        method: 'GET',
        headers: { 'x-apisports-key': apiKey },
        signal,
      });

      if (!response.ok) {
        throw new Error(`API-SPORTS ${response.status} on ${path}`);
      }

      const payload = (await response.json()) as ApiSportsResponse<T>;
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt >= retries || signal.aborted) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 400));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('API-SPORTS request failed');
}

function createApiProvider(signal: AbortSignal): ApiProvider {
  const useMock = process.env.USE_MOCK_DATA === 'true';
  if (useMock) {
    return {
      source: 'mock',
      getGamesByDate: async (date) => nbaMockProvider.getGamesByDate(date),
      getGamesByTeamSeason: async () => [],
      getPlayersByTeam: async (teamId) => nbaMockProvider.getPlayersByTeam(teamId),
      getPlayerStatistics: async (playerId) => nbaMockProvider.getPlayerStatistics(playerId),
      getPlayerStatisticsByGame: async () => [],
      getTeamName: (teamId) => nbaMockProvider.getTeamName(teamId),
    };
  }

  const apiKey = process.env.NBA_API_KEY;
  if (!apiKey) {
    throw new Error('NBA_API_KEY is missing');
  }

  return {
    source: 'real',
    getGamesByDate: async (date) => {
      const response = await apiGet<ApiSportsGame>(`/games?date=${date}`, apiKey, signal);
      return response.response || [];
    },
    getGamesByTeamSeason: async (teamId, season) => {
      const response = await apiGet<ApiSportsGame>(`/games?team=${teamId}&season=${season}`, apiKey, signal);
      return response.response || [];
    },
    getPlayersByTeam: async (teamId, season) => {
      const response = await apiGet<ApiSportsPlayer>(`/players?team=${teamId}&season=${season}`, apiKey, signal);
      return response.response || [];
    },
    getPlayerStatistics: async (playerId, season) => {
      const response = await apiGet<ApiSportsPlayerStat>(`/players/statistics?id=${playerId}&season=${season}`, apiKey, signal);
      return response.response || [];
    },
    getPlayerStatisticsByGame: async (gameId) => {
      const response = await apiGet<ApiSportsPlayerStat>(`/players/statistics?game=${gameId}`, apiKey, signal);
      return response.response || [];
    },
  };
}

function normalizeGame(game: ApiSportsGame, fallbackDate: string) {
  const home = game.teams?.home;
  const away = game.teams?.visitors;
  return {
    game_date: fallbackDate,
    home_team: home?.name || 'Unknown',
    away_team: away?.name || 'Unknown',
    home_team_id: toNumber(home?.id),
    away_team_id: toNumber(away?.id),
    home_logo: home?.logo || null,
    away_logo: away?.logo || null,
    game_time: game.date?.start || null,
    status: game.status?.long || 'Scheduled',
  };
}

function gameLogicalKey(gameDate: string, homeTeam: string, awayTeam: string): string {
  return `${gameDate}__${homeTeam}__${awayTeam}`;
}

function normalizePlayer(player: ApiSportsPlayer, teamId: number, teamName: string) {
  const first = (player.firstname || '').trim();
  const last = (player.lastname || '').trim();
  const composedName = `${first} ${last}`.trim();
  return {
    api_id: player.id,
    name: composedName || `Player ${player.id}`,
    team: teamName,
    team_id: teamId,
    position: player.leagues?.standard?.pos || '',
    photo: player.photo || null,
  };
}

function parseApiDate(value: string | null | undefined): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

type OpponentContext = {
  playerTeamId?: number | null;
  playerTeamName?: string | null;
  homeTeamId?: number | null;
  awayTeamId?: number | null;
  homeTeamName?: string | null;
  awayTeamName?: string | null;
};

function resolveOpponentFromGameContext(
  stat: ApiSportsPlayerStat,
  opponentContext?: OpponentContext
): { opponent: string; isHome: boolean | null } {
  const playerTeamId = toNumber(opponentContext?.playerTeamId);
  const playerTeamName = (opponentContext?.playerTeamName || '').trim();
  const homeTeamId = toNumber(opponentContext?.homeTeamId);
  const awayTeamId = toNumber(opponentContext?.awayTeamId);
  const homeTeamName = (opponentContext?.homeTeamName || '').trim();
  const awayTeamName = (opponentContext?.awayTeamName || '').trim();
  const statTeamName = (stat.team?.name || '').trim();
  const statTeamId = toNumber((stat as { team?: { id?: number | null } }).team?.id);
  const ownTeamName = playerTeamName || statTeamName;

  const safeOpponent = (candidate: string, isHome: boolean | null): { opponent: string; isHome: boolean | null } => {
    const normalizedCandidate = candidate.trim();
    if (!normalizedCandidate) return { opponent: '', isHome: null };
    if (ownTeamName && normalizedCandidate === ownTeamName) return { opponent: '', isHome: null };
    return { opponent: normalizedCandidate, isHome };
  };

  if (homeTeamId > 0 && awayTeamId > 0 && homeTeamId === awayTeamId) {
    return { opponent: '', isHome: null };
  }

  // 1) Best source: player's known internal team against game home/away ids
  if (playerTeamId > 0 && homeTeamId > 0 && awayTeamId > 0) {
    if (playerTeamId === homeTeamId) {
      return safeOpponent(awayTeamName, true);
    }
    if (playerTeamId === awayTeamId) {
      return safeOpponent(homeTeamName, false);
    }
  }

  // 2) Fallback: team id returned by stat payload
  if (statTeamId > 0 && homeTeamId > 0 && awayTeamId > 0) {
    if (statTeamId === homeTeamId) {
      return safeOpponent(awayTeamName, true);
    }
    if (statTeamId === awayTeamId) {
      return safeOpponent(homeTeamName, false);
    }
  }

  // 3) Fallback: team name returned by stat payload
  if (statTeamName && homeTeamName && awayTeamName) {
    if (statTeamName === homeTeamName) {
      return safeOpponent(awayTeamName, true);
    }
    if (statTeamName === awayTeamName) {
      return safeOpponent(homeTeamName, false);
    }
  }

  // 4) Safe failure mode:
  // never use the player's own team as opponent
  return { opponent: '', isHome: null };
}

function extractThreePointAttempts(stat: ApiSportsPlayerStat): number {
  const flatStat = stat as ApiSportsPlayerStat & { tpa?: number | string | null };
  if (flatStat.p3a !== undefined && flatStat.p3a !== null) {
    return toNumber(flatStat.p3a);
  }
  if (flatStat.tpa !== undefined && flatStat.tpa !== null) {
    return toNumber(flatStat.tpa);
  }

  const nestedStats = (stat as { statistics?: Array<{ p3a?: number | string | null; tpa?: number | string | null }> }).statistics;
  const firstStatBlock = nestedStats?.[0];
  if (firstStatBlock?.p3a !== undefined && firstStatBlock?.p3a !== null) {
    return toNumber(firstStatBlock.p3a);
  }
  if (firstStatBlock?.tpa !== undefined && firstStatBlock?.tpa !== null) {
    return toNumber(firstStatBlock.tpa);
  }
  return 0;
}

function normalizePlayerStat(
  playerId: number,
  internalGameId: number | null,
  stat: ApiSportsPlayerStat,
  fallbackGameDate: string | null = null,
  opponentContext?: OpponentContext
) {
  const opponentInfo = resolveOpponentFromGameContext(stat, opponentContext);
  const threePointAttempts = extractThreePointAttempts(stat);
  return {
    player_id: playerId,
    game_id: internalGameId,
    game_date: stat.game?.date ? stat.game.date.slice(0, 10) : fallbackGameDate,
    opponent: opponentInfo.opponent,
    is_home: opponentInfo.isHome,
    points: toNumber(stat.points),
    rebounds: toNumber(stat.totReb),
    assists: toNumber(stat.assists),
    three_pointers: toNumber(stat.tpm),
    fgm: toNumber(stat.fgm),
    fga: toNumber(stat.fga),
    steals: toNumber(stat.steals),
    blocks: toNumber(stat.blocks),
    fg2a: toNumber(stat.p2a),
    fg3a: threePointAttempts,
    three_pa: threePointAttempts,
    minutes: parseMinutes(stat.min),
  };
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return Number((values.reduce((acc, value) => acc + value, 0) / values.length).toFixed(1));
}


async function detectTableColumns(supabase: SupabaseClient, table: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', table);

  if (error || !data) return new Set<string>();
  return new Set<string>(data.map((row: { column_name: string }) => row.column_name));
}

function pickColumns<T extends Record<string, unknown>>(payload: T, columns: Set<string>): Partial<T> {
  if (!columns.size) return payload;
  const selected: Partial<T> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (columns.has(key)) {
      selected[key as keyof T] = value as T[keyof T];
    }
  }
  return selected;
}

async function createSyncLog(
  supabase: SupabaseClient,
  columns: Set<string>,
  payload: {
    jobType: string;
    status: SyncStatus;
    message: string;
    startedAt: string;
    finishedAt?: string;
    log?: string;
    gamesSynced?: number;
    playersSynced?: number;
    playerStatsSynced?: number;
    errors?: string[];
    syncMode?: 'bootstrap' | 'daily';
    routeSource?: 'cron' | 'manual' | null;
    requestId?: string | null;
  }
): Promise<SyncLogRecord | null> {
  const row = pickColumns(
    {
      job_type: payload.jobType,
      status: payload.status,
      message: payload.message,
      started_at: payload.startedAt,
      finished_at: payload.finishedAt ?? null,
      created_at: payload.startedAt,
      updated_at: payload.finishedAt ?? payload.startedAt,
      log: payload.log ?? payload.message,
      errors: payload.errors?.length ? payload.errors.join(' | ') : null,
      games_synced: payload.gamesSynced ?? 0,
      players_synced: payload.playersSynced ?? 0,
      player_stats_synced: payload.playerStatsSynced ?? 0,
      sync_mode: payload.syncMode ?? null,
      route_source: payload.routeSource ?? null,
      request_id: payload.requestId ?? null,
    },
    columns
  );

  const { data } = await supabase.from('sync_logs').insert(row).select('id').single();
  return (data as SyncLogRecord | null) || null;
}

async function updateSyncLog(
  supabase: SupabaseClient,
  columns: Set<string>,
  logId: number | string | null,
  payload: {
    status: SyncStatus;
    message: string;
    startedAt: string;
    finishedAt: string;
    errors: string[];
    gamesSynced: number;
    playersSynced?: number;
    playerStatsSynced?: number;
    jobType?: string;
    syncMode?: 'bootstrap' | 'daily';
    routeSource?: 'cron' | 'manual' | null;
    requestId?: string | null;
  }
) {
  const startedAtMs = new Date(payload.startedAt).getTime();
  const finishedAtMs = new Date(payload.finishedAt).getTime();
  const durationMs = Number.isFinite(startedAtMs) && Number.isFinite(finishedAtMs)
    ? Math.max(0, finishedAtMs - startedAtMs)
    : null;

  const row = pickColumns(
    {
      job_type: payload.jobType,
      status: payload.status,
      message: payload.message,
      started_at: payload.startedAt,
      finished_at: payload.finishedAt,
      updated_at: payload.finishedAt,
      log: payload.message,
      errors: payload.errors.length ? payload.errors.join(' | ') : null,
      games_synced: payload.gamesSynced,
      players_synced: payload.playersSynced ?? 0,
      player_stats_synced: payload.playerStatsSynced ?? 0,
      sync_mode: payload.syncMode ?? null,
      route_source: payload.routeSource ?? null,
      request_id: payload.requestId ?? null,
      duration_ms: durationMs,
    },
    columns
  );

  if (logId !== null) {
    await supabase.from('sync_logs').update(row).eq('id', logId);
    return;
  }

  await supabase.from('sync_logs').insert(row);
}

async function hasRunningSync(supabase: SupabaseClient, columns: Set<string>, now: Date): Promise<boolean> {
  if (!columns.has('status')) return false;

  const cutoff = new Date(now.getTime() - LOCK_WINDOW_MS).toISOString();
  const timestampColumn = columns.has('started_at') ? 'started_at' : columns.has('created_at') ? 'created_at' : null;

  if (!timestampColumn) {
    return false;
  }

  const staleCandidates = await supabase
    .from('sync_logs')
    .select(`id,${timestampColumn}`)
    .in('status', [...RUNNING_STATUSES])
    .lt(timestampColumn, cutoff)
    .limit(50);

  if (staleCandidates.data?.length) {
    const staleIds = staleCandidates.data
      .map((row) => row.id)
      .filter((id): id is number | string => typeof id === 'number' || typeof id === 'string');

    if (staleIds.length) {
      const staleMessage = 'Recovered stale running sync log; marked as error before next run.';
      await supabase
        .from('sync_logs')
        .update(pickColumns({
          status: 'error',
          message: staleMessage,
          log: staleMessage,
          updated_at: nowIso(),
          finished_at: nowIso(),
        }, columns))
        .in('id', staleIds);
    }
  }

  const { count } = await supabase
    .from('sync_logs')
    .select('id,status', { count: 'exact', head: true })
    .in('status', [...RUNNING_STATUSES])
    .gte(timestampColumn, cutoff);

  return (count || 0) > 0;
}

async function hasOtherRunningSync(
  supabase: SupabaseClient,
  columns: Set<string>,
  now: Date,
  currentLogId: number | string | null
): Promise<boolean> {
  if (!columns.has('status') || currentLogId === null) return false;
  const timestampColumn = columns.has('started_at') ? 'started_at' : columns.has('created_at') ? 'created_at' : null;
  if (!timestampColumn) return false;

  const cutoff = new Date(now.getTime() - LOCK_WINDOW_MS).toISOString();
  const { data } = await supabase
    .from('sync_logs')
    .select(`id,${timestampColumn}`)
    .in('status', [...RUNNING_STATUSES])
    .gte(timestampColumn, cutoff)
    .order(timestampColumn, { ascending: true })
    .limit(10);

  const currentLogIdString = String(currentLogId);
  return (data || []).some((row) => String((row as { id: number | string | null }).id) !== currentLogIdString);
}

type PlayerStatMetricsRow = {
  player_id: number | null;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  three_pointers: number | null;
  fgm: number | null;
  fga: number | null;
  steals: number | null;
  blocks: number | null;
  fg2a: number | null;
  fg3a: number | null;
  three_pa: number | null;
};

function buildPlayerMetricPayloads(
  playerId: number,
  stats: PlayerStatMetricsRow[],
  metricColumns: Set<string>
) {
  const doubleDoubleValues = stats.map((row) => {
    const categories = [
      toNumber(row.points),
      toNumber(row.rebounds),
      toNumber(row.assists),
      toNumber(row.steals),
      toNumber(row.blocks),
    ].filter((value) => value >= 10).length;
    return categories >= 2 ? 1 : 0;
  });
  const tripleDoubleValues = stats.map((row) => {
    const categories = [
      toNumber(row.points),
      toNumber(row.rebounds),
      toNumber(row.assists),
      toNumber(row.steals),
      toNumber(row.blocks),
    ].filter((value) => value >= 10).length;
    return categories >= 3 ? 1 : 0;
  });

  const metricMap: Record<string, number[]> = {
    PTS: stats.map((row) => toNumber(row.points)),
    REB: stats.map((row) => toNumber(row.rebounds)),
    AST: stats.map((row) => toNumber(row.assists)),
    '3PM': stats.map((row) => toNumber(row.three_pointers)),
    PA: stats.map((row) => toNumber(row.points) + toNumber(row.assists)),
    PR: stats.map((row) => toNumber(row.points) + toNumber(row.rebounds)),
    PRA: stats.map((row) => toNumber(row.points) + toNumber(row.rebounds) + toNumber(row.assists)),
    AR: stats.map((row) => toNumber(row.assists) + toNumber(row.rebounds)),
    DD: doubleDoubleValues,
    TD: tripleDoubleValues,
    STEAL: stats.map((row) => toNumber(row.steals)),
    BLOCKS: stats.map((row) => toNumber(row.blocks)),
    SB: stats.map((row) => toNumber(row.steals) + toNumber(row.blocks)),
    FG2A: stats.map((row) => {
      const fg2a = toNumber(row.fg2a);
      if (fg2a > 0) return fg2a;
      const fga = toNumber(row.fga);
      const fg3a = toNumber(row.fg3a || row.three_pa);
      if (fga > 0 && fg3a >= 0) return Math.max(0, fga - fg3a);
      return 0;
    }),
    FG3A: stats.map((row) => toNumber(row.fg3a || row.three_pa)),
  };

  const updatedAt = nowIso();
  return Object.entries(metricMap).map(([stat, values]) => pickColumns(
    {
      player_id: playerId,
      stat,
      avg_l5: avg(values.slice(0, 5)),
      avg_l10: avg(values.slice(0, 10)),
      avg_l20: avg(values.slice(0, 20)),
      avg_l30: avg(values.slice(0, 30)),
      avg_season: avg(values),
      updated_at: updatedAt,
    },
    metricColumns
  ));
}

async function recomputePlayerMetrics(
  supabase: SupabaseClient,
  playerIds: Iterable<number>,
  metricColumns: Set<string>
): Promise<number> {
  const uniquePlayerIds = [...new Set([...playerIds].filter((playerId) => Number.isInteger(playerId) && playerId > 0))];
  if (!uniquePlayerIds.length) return 0;

  const playerStatsMap = new Map<number, PlayerStatMetricsRow[]>();
  const chunkSize = 200;

  for (let index = 0; index < uniquePlayerIds.length; index += chunkSize) {
    const chunk = uniquePlayerIds.slice(index, index + chunkSize);
    const { data: statsRows, error } = await supabase
      .from('player_stats')
      .select('player_id,game_id,points,rebounds,assists,three_pointers,fgm,fga,game_date,steals,blocks,fg2a,fg3a,three_pa')
      .in('player_id', chunk)
      .order('player_id', { ascending: true })
      .order('game_date', { ascending: false })
      .order('game_id', { ascending: false });

    if (error) {
      throw new Error(`player_stats read failed while recomputing metrics: ${error.message}`);
    }

    for (const rawRow of (statsRows || []) as PlayerStatMetricsRow[]) {
      const playerId = toNumber(rawRow.player_id);
      if (!playerId) continue;
      const rows = playerStatsMap.get(playerId) ?? [];
      if (rows.length < 120) {
        rows.push(rawRow);
        playerStatsMap.set(playerId, rows);
      }
    }
  }

  const metricUpserts: Array<Record<string, unknown>> = [];
  for (const playerId of uniquePlayerIds) {
    const stats = playerStatsMap.get(playerId) || [];
    if (!stats.length) continue;
    metricUpserts.push(...buildPlayerMetricPayloads(playerId, stats, metricColumns));
  }

  if (!metricUpserts.length) return 0;

  for (let index = 0; index < metricUpserts.length; index += 500) {
    const chunk = metricUpserts.slice(index, index + 500);
    const { error } = await supabase.from('player_metrics').upsert(chunk, { onConflict: 'player_id,stat' });
    if (error) {
      throw new Error(`player_metrics upsert failed: ${error.message}`);
    }
  }

  return metricUpserts.length;
}


export async function recomputeSinglePlayerMetrics(playerId: number) {
  if (!Number.isInteger(playerId) || playerId <= 0) {
    throw new Error(`Invalid player id for metrics recompute: ${playerId}`);
  }

  const supabase = getSupabaseAdmin();
  const metricColumns = await detectTableColumns(supabase, 'player_metrics');
  const metricsRecomputed = await recomputePlayerMetrics(supabase, [playerId], metricColumns);

  invalidateCacheByPrefix('games:');
  invalidateCacheByPrefix('players:');
  invalidateCacheByPrefix('metrics:');
  invalidateCacheByPrefix('metrics-base:');

  return {
    playerId,
    metricsRecomputed,
  };
}


async function recomputeAllPlayerMetricsFromStats(supabase: SupabaseClient) {
  const metricColumns = await detectTableColumns(supabase, 'player_metrics');
  const playerIds = new Set<number>();
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('player_stats')
      .select('player_id')
      .order('player_id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`player_stats read failed while loading ids for full metrics recompute: ${error.message}`);
    }

    const rows = data || [];
    for (const row of rows as Array<{ player_id: number | null }>) {
      const playerId = toNumber(row.player_id);
      if (playerId > 0) {
        playerIds.add(playerId);
      }
    }

    if (rows.length < pageSize) {
      break;
    }
  }

  if (!playerIds.size) return;
  await recomputePlayerMetrics(supabase, playerIds, metricColumns);
}

async function runSyncCore(
  supabase: SupabaseClient,
  signal: AbortSignal,
  syncMode: 'bootstrap' | 'daily',
  bootstrapTeamIds: number[] = []
): Promise<Omit<SyncSummary, 'startedAt' | 'finishedAt'>> {
  const apiProvider = createApiProvider(signal);
  const isMock = apiProvider.source === 'mock';
  const now = new Date();
  const season = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const statsSeason = resolveStatsSeason(season);
  const dateTargets = Array.from({ length: DATE_WINDOW_PAST_DAYS + DATE_WINDOW_FUTURE_DAYS + 1 }, (_, index) => {
    const offset = index - DATE_WINDOW_PAST_DAYS;
    return dateOnly(addDays(now, offset));
  });

  const gamesPerDay = await Promise.all(
    dateTargets.map(async (day) => {
      const games = await apiProvider.getGamesByDate(day, signal);
      return { day, games };
    })
  );

  const uniqueGameMap = new Map<number, { day: string; game: ApiSportsGame }>();
  let bootstrapRelevantTeamIds: Set<number> | null = null;
  for (const dayGames of gamesPerDay) {
    for (const game of dayGames.games) {
      const gameDay = game.date?.start?.slice(0, 10) || dayGames.day;
      uniqueGameMap.set(game.id, { day: gameDay, game });
    }
  }

  if (!isMock && syncMode === 'bootstrap') {
    const requestTeamBatch = [...new Set(bootstrapTeamIds.filter((teamId) => Number.isInteger(teamId) && teamId > 0))];
    const hasRequestTeamBatch = requestTeamBatch.length > 0;
    const configuredTeamIds = parseTeamIds(process.env.NBA_BOOTSTRAP_TEAM_IDS);
    const baselineTeamIds = hasRequestTeamBatch
      ? requestTeamBatch
      : configuredTeamIds.length
        ? configuredTeamIds
        : DEFAULT_BOOTSTRAP_TEAM_IDS;
    const relevantTeamIds = new Set<number>(baselineTeamIds);

    if (!hasRequestTeamBatch) {
      for (const entry of uniqueGameMap.values()) {
        const home = toNumber(entry.game.teams?.home?.id);
        const away = toNumber(entry.game.teams?.visitors?.id);
        if (home > 0) relevantTeamIds.add(home);
        if (away > 0) relevantTeamIds.add(away);
      }
    }

    for (const teamId of relevantTeamIds) {
      const seasonGames = await apiProvider.getGamesByTeamSeason(teamId, season, signal);
      for (const game of seasonGames) {
        const gameDay = game.date?.start?.slice(0, 10) || dateOnly(now);
        uniqueGameMap.set(game.id, { day: gameDay, game });
      }
    }

    bootstrapRelevantTeamIds = relevantTeamIds;
  }

  const normalizedGames = [...uniqueGameMap.values()].map((entry) => normalizeGame(entry.game, entry.day));
  const apiGameToInternalGameId = new Map<number, number>();
  if (normalizedGames.length > 0) {
    const dedupedNormalizedGames = (() => {
      const byLogicalKey = new Map<string, (typeof normalizedGames)[number]>();
      for (const game of normalizedGames) {
        const logicalKey = gameLogicalKey(game.game_date, game.home_team, game.away_team);
        byLogicalKey.set(logicalKey, game);
      }
      return [...byLogicalKey.values()];
    })();

    const gameColumns = await detectTableColumns(supabase, 'games');
    const gamesPayload = dedupedNormalizedGames.map((row) => pickColumns(row, gameColumns));

    const { error } = await supabase.from('games').upsert(gamesPayload, {
      onConflict: 'game_date,home_team,away_team',
    });

    if (error) {
      throw new Error(`games upsert failed: ${error.message}`);
    }

    const relevantDates = [...new Set(dedupedNormalizedGames.map((game) => game.game_date).filter(Boolean))];
    if (relevantDates.length > 0) {
      const { data: gameRows, error: gameRowsError } = await supabase
        .from('games')
        .select('id,game_date,home_team,away_team')
        .in('game_date', relevantDates);

      if (gameRowsError) {
        throw new Error(`games lookup failed after upsert: ${gameRowsError.message}`);
      }

      const internalGameIdByLogicalKey = new Map<string, number>();
      for (const row of (gameRows || []) as Array<{ id: number | null; game_date: string | null; home_team: string | null; away_team: string | null }>) {
        const internalId = toNumber(row.id);
        const gameDate = row.game_date || '';
        const homeTeam = row.home_team || '';
        const awayTeam = row.away_team || '';
        if (!internalId || !gameDate || !homeTeam || !awayTeam) continue;
        internalGameIdByLogicalKey.set(gameLogicalKey(gameDate, homeTeam, awayTeam), internalId);
      }

      for (const [apiGameId, entry] of uniqueGameMap.entries()) {
        const logicalKey = gameLogicalKey(
          entry.day,
          entry.game.teams?.home?.name || 'Unknown',
          entry.game.teams?.visitors?.name || 'Unknown'
        );
        const internalGameId = internalGameIdByLogicalKey.get(logicalKey);
        if (internalGameId) {
          apiGameToInternalGameId.set(apiGameId, internalGameId);
        }
      }
    }
  }

  const teamIds = new Set<number>();
  for (const entry of uniqueGameMap.values()) {
    const home = toNumber(entry.game.teams?.home?.id);
    const away = toNumber(entry.game.teams?.visitors?.id);
    if (home > 0) teamIds.add(home);
    if (away > 0) teamIds.add(away);
  }

  const selectedTeamIds = isMock
    ? [...teamIds].slice(0, MOCK_MAX_TEAMS)
    : syncMode === 'bootstrap' && bootstrapRelevantTeamIds
      ? [...bootstrapRelevantTeamIds]
      : [...teamIds];
  let playersSynced = 0;
  let playerStatsSynced = 0;
  let playerTeamReconciled = 0;
  const syncedPlayerApiIds: number[] = [];
  const latestTeamAssignmentByApi = new Map<number, { teamId: number; teamName: string; observedAt: number }>();

  for (const teamId of selectedTeamIds) {
    const playersRaw = await apiProvider.getPlayersByTeam(teamId, season, signal);
    if (!playersRaw.length) continue;
    const selectedPlayers = isMock ? playersRaw.slice(0, MOCK_MAX_PLAYERS_PER_TEAM) : playersRaw;

    const teamName =
      [...uniqueGameMap.values()].find((entry) => toNumber(entry.game.teams?.home?.id) === teamId)?.game.teams?.home?.name ||
      [...uniqueGameMap.values()].find((entry) => toNumber(entry.game.teams?.visitors?.id) === teamId)?.game.teams?.visitors?.name ||
      apiProvider.getTeamName?.(teamId) ||
      '';

    const normalizedPlayers = selectedPlayers.map((player) => normalizePlayer(player, teamId, teamName));
    playersSynced += normalizedPlayers.length;
    syncedPlayerApiIds.push(...normalizedPlayers.map((player) => player.api_id));

    const { error: playerUpsertError } = await supabase.from('players').upsert(normalizedPlayers, { onConflict: 'api_id' });
    if (playerUpsertError) {
      throw new Error(`players upsert failed for team ${teamId}: ${playerUpsertError.message}`);
    }
  }

  const uniqueSyncedApiIds = [...new Set(syncedPlayerApiIds)];
  const { data: allPlayerRows } = uniqueSyncedApiIds.length
    ? await supabase.from('players').select('id,api_id,team_id,team').in('api_id', uniqueSyncedApiIds)
    : { data: [] as Array<{ id: number; api_id: number; team_id: number | null; team: string | null }> };
  const playerIdByApi = new Map<number, number>((allPlayerRows || []).map((row) => [toNumber(row.api_id), toNumber(row.id)]));
  const playerTeamIdByApi = new Map<number, number>((allPlayerRows || []).map((row) => [toNumber(row.api_id), toNumber(row.team_id)]));
  const playerTeamNameByApi = new Map<number, string>((allPlayerRows || []).map((row) => [toNumber(row.api_id), (row.team || '').trim()]));
  const metricPlayerIds = new Set<number>();

  if (isMock) {
    for (const apiId of uniqueSyncedApiIds) {
      const internalPlayerId = playerIdByApi.get(apiId);
      if (!internalPlayerId) {
        continue;
      }

      let statsRaw = await apiProvider.getPlayerStatistics(apiId, statsSeason, signal);
      if (!statsRaw.length && statsSeason === season) {
        statsRaw = await apiProvider.getPlayerStatistics(apiId, season - 1, signal);
      }

      const statsRows = statsRaw
        .map((stat) => {
          const apiGameId = toNumber(stat.game?.id);
          return normalizePlayerStat(internalPlayerId, apiGameToInternalGameId.get(apiGameId) ?? null, stat, null, {
            playerTeamId: playerTeamIdByApi.get(apiId) ?? null,
            playerTeamName: playerTeamNameByApi.get(apiId) ?? null,
          });
        })
        .filter((row) => row.game_id && row.game_date)
        .slice(0, isMock ? MOCK_MAX_PLAYER_STATS : 30);

      if (!statsRows.length) continue;

      const { error: statsUpsertError } = await supabase
        .from('player_stats')
        .upsert(statsRows, { onConflict: 'player_id,game_id' });

      if (statsUpsertError) {
        const message = statsUpsertError.message.toLowerCase();
        const missingConstraint = message.includes('no unique') || message.includes('there is no unique');
        if (!missingConstraint) {
          throw new Error(`player_stats upsert failed for player ${apiId}: ${statsUpsertError.message}`);
        }

        for (const row of statsRows) {
          await supabase
            .from('player_stats')
            .delete()
            .eq('player_id', row.player_id)
            .eq('game_id', row.game_id);
        }

        const { error: statsInsertError } = await supabase.from('player_stats').insert(statsRows);
        if (statsInsertError) {
          throw new Error(`player_stats insert fallback failed for player ${apiId}: ${statsInsertError.message}`);
        }
      }

      playerStatsSynced += statsRows.length;
      for (const row of statsRows) {
        metricPlayerIds.add(row.player_id);
      }
    }
  } else {
    const selectedGameIds = [...uniqueGameMap.keys()].filter((gameId) => {
      if (syncMode !== 'bootstrap') return true;
      const gameEntry = uniqueGameMap.get(gameId);
      if (!gameEntry) return false;
      return isLikelyFinishedGame(gameEntry.game, now);
    });
    let loggedFirstRealGameStatsDebug = false;
    
    for (const gameId of selectedGameIds) {
      const statsRaw = await apiProvider.getPlayerStatisticsByGame(gameId, statsSeason, signal);
      const fallbackGameDate = uniqueGameMap.get(gameId)?.day ?? null;
      const gameDetails = uniqueGameMap.get(gameId)?.game;
      const homeTeamId = toNumber(gameDetails?.teams?.home?.id) || null;
      const awayTeamId = toNumber(gameDetails?.teams?.visitors?.id) || null;
      const homeTeamName = gameDetails?.teams?.home?.name || '';
      const awayTeamName = gameDetails?.teams?.visitors?.name || '';
      
      if (!isMock && !loggedFirstRealGameStatsDebug) {
        const firstDebugStat = statsRaw[0] as
          | (ApiSportsPlayerStat & { player?: { id?: number | null }; game?: { id?: number | null; date?: string | null } })
          | undefined;
        console.log('DEBUG GAME STATS:', {
          gameId,
          statsLength: statsRaw?.length,
          firstItemKeys: firstDebugStat ? Object.keys(firstDebugStat) : null,
          hasPlayerId: firstDebugStat?.player?.id ?? null,
          hasGameId: firstDebugStat?.game?.id ?? null,
          hasGameDate: firstDebugStat?.game?.date ?? null,
        });
        loggedFirstRealGameStatsDebug = true;
      }

      const statsRows = statsRaw
        .map((stat) => {
          const statPlayerApiId = toNumber((stat as { player?: { id?: number | null } }).player?.id);
          const internalPlayerId = playerIdByApi.get(statPlayerApiId);
          if (!internalPlayerId) {
            return null;
          }
          const statTeam = (stat as { team?: { id?: number | null; name?: string | null } }).team;
          const statTeamId = toNumber(statTeam?.id);
          const statTeamName = (statTeam?.name || '').trim();
          if (statTeamId > 0 && statTeamName) {
            const observedAt = parseApiDate(stat.game?.date) || Date.now();
            const previous = latestTeamAssignmentByApi.get(statPlayerApiId);
            if (!previous || observedAt >= previous.observedAt) {
              latestTeamAssignmentByApi.set(statPlayerApiId, {
                teamId: statTeamId,
                teamName: statTeamName,
                observedAt,
              });
            }
          }
          const statGameApiId = toNumber(stat.game?.id);
          return normalizePlayerStat(internalPlayerId, apiGameToInternalGameId.get(statGameApiId) ?? null, stat, fallbackGameDate, {
            playerTeamName: playerTeamNameByApi.get(statPlayerApiId) ?? null,
            playerTeamId: playerTeamIdByApi.get(statPlayerApiId) ?? null,
            homeTeamId,
            awayTeamId,
            homeTeamName,
            awayTeamName,
          });
        })
        .filter((row): row is ReturnType<typeof normalizePlayerStat> => Boolean(row?.game_id && row.game_date));

      if (!loggedFirstRealGameStatsDebug) {
        const firstStat = statsRaw[0] as
          | (ApiSportsPlayerStat & { player?: { id?: number | null }; game?: { id?: number | null; date?: string | null } })
          | undefined;
        const firstStatPlayerApiId = toNumber(firstStat?.player?.id);
        const matchedInternalPlayerId = playerIdByApi.get(firstStatPlayerApiId);

        console.debug('[nba-sync] first real game stats checkpoint', {
          gameId,
          responseLength: statsRaw.length,
          firstItemKeys: firstStat ? Object.keys(firstStat) : [],
          hasPlayerId: Boolean(firstStat?.player?.id),
          hasGameId: Boolean(firstStat?.game?.id),
          hasGameDate: Boolean(firstStat?.game?.date),
          playerIdMapped: Boolean(matchedInternalPlayerId),
          rowsAfterFinalFilter: statsRows.length,
        });
        loggedFirstRealGameStatsDebug = true;
      }

      if (!statsRaw.length) continue;
      if (!statsRows.length) continue;

      const { error: statsUpsertError } = await supabase
        .from('player_stats')
        .upsert(statsRows, { onConflict: 'player_id,game_id' });

      if (statsUpsertError) {
        const message = statsUpsertError.message.toLowerCase();
        const missingConstraint = message.includes('no unique') || message.includes('there is no unique');
        if (!missingConstraint) {
          throw new Error(`player_stats upsert failed for game ${gameId}: ${statsUpsertError.message}`);
        }

        for (const row of statsRows) {
          await supabase
            .from('player_stats')
            .delete()
            .eq('player_id', row.player_id)
            .eq('game_id', row.game_id);
        }

        const { error: statsInsertError } = await supabase.from('player_stats').insert(statsRows);
        if (statsInsertError) {
          throw new Error(`player_stats insert fallback failed for game ${gameId}: ${statsInsertError.message}`);
        }
      }

      playerStatsSynced += statsRows.length;
      for (const row of statsRows) {
        metricPlayerIds.add(row.player_id);
      }
    }
  }

  if (latestTeamAssignmentByApi.size > 0) {
    const reconciliationPayload = [...latestTeamAssignmentByApi.entries()].map(([apiId, assignment]) => ({
      api_id: apiId,
      team_id: assignment.teamId,
      team: assignment.teamName,
    }));

    const { error: reconciliationError } = await supabase
      .from('players')
      .upsert(reconciliationPayload, { onConflict: 'api_id' });

    if (reconciliationError) {
      throw new Error(`players team reconciliation failed: ${reconciliationError.message}`);
    }
    playerTeamReconciled = reconciliationPayload.length;
  }

  if (metricPlayerIds.size > 0) {
    const metricColumns = await detectTableColumns(supabase, 'player_metrics');
    await recomputePlayerMetrics(supabase, metricPlayerIds, metricColumns);
  }

  invalidateCacheByPrefix('games:');
  invalidateCacheByPrefix('players:');
  invalidateCacheByPrefix('metrics:');
  invalidateCacheByPrefix('metrics-base:');
  invalidateCacheByPrefix('admin:');

  return {
    status: 'success',
    message: `Sync (${apiProvider.source}, ${syncMode}) finished with ${normalizedGames.length} games, ${playersSynced} players and ${playerStatsSynced} player_stats upserted.`,
    gamesSynced: normalizedGames.length,
    teamsSynced: selectedTeamIds.length,
    playersSynced,
    playerStatsSynced,
    errors: [],
    debug: {
      requestId: null,
      routeSource: null,
      hasRunningSync: null,
      inProcessRunAlready: false,
      distributedLock: null,
      playerTeamReconciled,
    },
  };
}

export async function runNbaSyncJob(options: RunNbaSyncOptions = {}): Promise<SyncSummary> {
  const syncMode = options.syncMode ?? 'daily';
  const debugBase = {
    requestId: options.requestId ?? null,
    routeSource: options.routeSource ?? null,
    syncMode,
  };

  const startedAt = nowIso();
  let distributedLockState: 'acquired' | 'locked' | 'unavailable' | null = 'unavailable';
  let hasRunningSyncResult: boolean | null = null;

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const syncLogColumns = await detectTableColumns(supabase, 'sync_logs');

  let logId: string | number | null = null;

  try {
    hasRunningSyncResult = await hasRunningSync(supabase, syncLogColumns, now);
    if (hasRunningSyncResult) {
      const finishedAt = nowIso();
      await createSyncLog(supabase, syncLogColumns, {
        jobType: 'nba_incremental_sync',
        status: 'skipped',
        message: 'Sync skipped because a recent running sync exists.',
        startedAt,
        finishedAt,
        errors: [],
        gamesSynced: 0,
        playersSynced: 0,
        playerStatsSynced: 0,
        syncMode,
        routeSource: debugBase.routeSource,
        requestId: debugBase.requestId,
      });

      const skippedSummary: SyncSummary = {
        status: 'skipped',
        message: 'Sync skipped because a recent running sync exists.',
        gamesSynced: 0,
        teamsSynced: 0,
        playersSynced: 0,
        playerStatsSynced: 0,
        errors: [],
        startedAt,
        finishedAt,
        debug: {
          ...debugBase,
          hasRunningSync: hasRunningSyncResult,
          inProcessRunAlready: false,
          distributedLock: 'locked',
        },
      };
      return skippedSummary;
    }

    const startLogContext = JSON.stringify({
      requestId: debugBase.requestId,
      routeSource: debugBase.routeSource,
    });
    const log = await createSyncLog(supabase, syncLogColumns, {
      jobType: 'nba_incremental_sync',
      status: 'running',
      message: 'Sync started',
      startedAt,
      log: `Sync started ${startLogContext}`,
      gamesSynced: 0,
      playersSynced: 0,
      playerStatsSynced: 0,
      syncMode,
      routeSource: debugBase.routeSource,
      requestId: debugBase.requestId,
    });
    logId = log?.id ?? null;
    distributedLockState = 'acquired';

    const hasConcurrentRunningSync = await hasOtherRunningSync(supabase, syncLogColumns, new Date(), logId);
    if (hasConcurrentRunningSync) {
      distributedLockState = 'locked';
      const finishedAt = nowIso();
      const message = 'Sync skipped because another distributed sync run is already in progress.';
      await updateSyncLog(supabase, syncLogColumns, logId, {
        status: 'skipped',
        message,
        startedAt,
        finishedAt,
        errors: [],
        gamesSynced: 0,
        playersSynced: 0,
        playerStatsSynced: 0,
        syncMode,
        routeSource: debugBase.routeSource,
        requestId: debugBase.requestId,
      });

      return {
        status: 'skipped',
        message,
        gamesSynced: 0,
        teamsSynced: 0,
        playersSynced: 0,
        playerStatsSynced: 0,
        errors: [],
        startedAt,
        finishedAt,
        debug: {
          ...debugBase,
          hasRunningSync: true,
          inProcessRunAlready: false,
          distributedLock: distributedLockState,
        },
      };
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort('sync_timeout'), SYNC_TIMEOUT_MS);

    let partial: Omit<SyncSummary, 'startedAt' | 'finishedAt'>;
    try {
      partial = await runSyncCore(supabase, controller.signal, syncMode, options.bootstrapTeamIds ?? []);
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (partial.status === 'success') {
      await recomputeAllPlayerMetricsFromStats(supabase);
      invalidateCacheByPrefix('games:');
      invalidateCacheByPrefix('players:');
      invalidateCacheByPrefix('metrics:');
      invalidateCacheByPrefix('metrics-base:');
    }

    const finishedAt = nowIso();
    await updateSyncLog(supabase, syncLogColumns, logId, {
      status: partial.status,
      message: partial.message,
      startedAt,
      finishedAt,
      errors: partial.errors,
      gamesSynced: partial.gamesSynced,
      playersSynced: partial.playersSynced,
      playerStatsSynced: partial.playerStatsSynced,
      syncMode,
      routeSource: debugBase.routeSource,
      requestId: debugBase.requestId,
    });

    return {
      ...partial,
      startedAt,
      finishedAt,
      debug: {
        ...(partial.debug || {}),
        ...debugBase,
        hasRunningSync: hasRunningSyncResult,
        inProcessRunAlready: false,
        distributedLock: distributedLockState,
      },
    };
  } catch (error) {
    const finishedAt = nowIso();
    const message = error instanceof Error ? error.message : 'Unknown sync failure';
    await updateSyncLog(supabase, syncLogColumns, logId, {
      status: 'error',
      message,
      startedAt,
      finishedAt,
      errors: [message],
      gamesSynced: 0,
      playersSynced: 0,
      playerStatsSynced: 0,
      jobType: 'nba_incremental_sync',
      syncMode,
      routeSource: debugBase.routeSource,
      requestId: debugBase.requestId,
    });

    return {
      status: 'error',
      message,
      gamesSynced: 0,
      teamsSynced: 0,
      playersSynced: 0,
      playerStatsSynced: 0,
      errors: [message],
      startedAt,
      finishedAt,
      debug: {
        ...debugBase,
        hasRunningSync: hasRunningSyncResult,
        inProcessRunAlready: false,
        distributedLock: distributedLockState,
      },
    };
  } finally {
    // no-op; distributed lock is represented by sync_logs rows
  }
}
