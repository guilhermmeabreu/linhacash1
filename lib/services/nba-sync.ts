import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { invalidateCacheByPrefix } from '@/lib/cache/memory-cache';
import { nbaMockProvider, type ApiSportsGame, type ApiSportsPlayer, type ApiSportsPlayerStat } from '@/lib/mock/nbaMock';
import { upstashAvailable, upstashDeleteIfValueMatches, upstashGet, upstashSetNxEx, upstashTtl } from '@/lib/upstash-rest';

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
    hasRunningSync: boolean | null;
    inProcessRunAlready: boolean;
    distributedLock: 'acquired' | 'locked' | 'unavailable' | null;
  };
};

type RunNbaSyncOptions = {
  requestId?: string | null;
  routeSource?: 'cron' | 'manual' | null;
};

type ApiSportsResponse<T> = { response?: T[] };

type SyncLogRecord = {
  id: number | string;
};

const BASE_URL = 'https://v2.nba.api-sports.io';
const RUNNING_STATUSES = new Set(['running', 'in_progress']);
const LOCK_WINDOW_MS = 15 * 60_000;
const SYNC_TIMEOUT_MS = 8 * 60_000;
const STALE_LOCK_RECOVERY_THRESHOLD_MS = LOCK_WINDOW_MS;
const REDIS_SYNC_LOCK_KEY = 'lock:nba_sync';
const DATE_WINDOW_PAST_DAYS = 2;
const DATE_WINDOW_FUTURE_DAYS = 3;
const MOCK_MAX_TEAMS = 4;
const MOCK_MAX_PLAYERS_PER_TEAM = 6;
const MOCK_MAX_PLAYER_STATS = 12;

let inProcessRun = false;

type ApiProvider = {
  source: 'real' | 'mock';
  getGamesByDate: (date: string, signal: AbortSignal) => Promise<ApiSportsGame[]>;
  getPlayersByTeam: (teamId: number, season: number, signal: AbortSignal) => Promise<ApiSportsPlayer[]>;
  getPlayerStatistics: (playerId: number, season: number, signal: AbortSignal) => Promise<ApiSportsPlayerStat[]>;
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
      getPlayersByTeam: async (teamId) => nbaMockProvider.getPlayersByTeam(teamId),
      getPlayerStatistics: async (playerId) => nbaMockProvider.getPlayerStatistics(playerId),
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
    getPlayersByTeam: async (teamId, season) => {
      const response = await apiGet<ApiSportsPlayer>(`/players?team=${teamId}&season=${season}`, apiKey, signal);
      return response.response || [];
    },
    getPlayerStatistics: async (playerId, season) => {
      const response = await apiGet<ApiSportsPlayerStat>(`/players/statistics?id=${playerId}&season=${season}`, apiKey, signal);
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

function normalizePlayerStat(playerId: number, stat: ApiSportsPlayerStat) {
  return {
    player_id: playerId,
    game_id: toNumber(stat.game?.id) || null,
    game_date: stat.game?.date ? stat.game.date.slice(0, 10) : null,
    opponent: stat.team?.name || '',
    is_home: null,
    points: toNumber(stat.points),
    rebounds: toNumber(stat.totReb),
    assists: toNumber(stat.assists),
    three_pointers: toNumber(stat.tpm),
    fgm: toNumber(stat.fgm),
    fga: toNumber(stat.fga),
    steals: toNumber(stat.steals),
    blocks: toNumber(stat.blocks),
    fg2a: toNumber(stat.p2a),
    fg3a: toNumber(stat.p3a),
    three_pa: toNumber(stat.p3a),
    minutes: parseMinutes(stat.min),
  };
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return Number((values.reduce((acc, value) => acc + value, 0) / values.length).toFixed(1));
}


function parseLockStartedAt(lockValue: string | null): number | null {
  if (!lockValue) return null;
  const [startedAt] = lockValue.split(':');
  if (!startedAt) return null;

  const timestamp = Date.parse(startedAt);
  return Number.isFinite(timestamp) ? timestamp : null;
}

async function tryRecoverStaleDistributedLock(lockValue: string): Promise<'recovered' | 'missing' | 'not_recovered'> {
  const currentLockValue = await upstashGet(REDIS_SYNC_LOCK_KEY);
  if (!currentLockValue) return 'missing';

  const ttlSeconds = await upstashTtl(REDIS_SYNC_LOCK_KEY);
  const lockHasExpiry = typeof ttlSeconds === 'number' && ttlSeconds > 0;

  const lockStartedAt = parseLockStartedAt(currentLockValue);
  if (lockHasExpiry) {
    if (!lockStartedAt) return 'not_recovered';
    const lockAge = Date.now() - lockStartedAt;
    if (lockAge < STALE_LOCK_RECOVERY_THRESHOLD_MS) return 'not_recovered';
  } else if (!lockStartedAt) {
    // Legacy/manual lock value without timestamp and without expiry.
    // It cannot be age-validated, so recover it as stale to avoid permanent skip.
  } else {
    const lockAge = Date.now() - lockStartedAt;
    if (lockAge < STALE_LOCK_RECOVERY_THRESHOLD_MS) return 'not_recovered';
  }

  if (lockHasExpiry) {
    return 'not_recovered';
  }

  await upstashDeleteIfValueMatches(REDIS_SYNC_LOCK_KEY, currentLockValue);
  const retryState = await upstashSetNxEx(REDIS_SYNC_LOCK_KEY, lockValue, Math.ceil((SYNC_TIMEOUT_MS + 2 * 60_000) / 1000));
  return retryState === 'acquired' ? 'recovered' : 'not_recovered';
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
  payload: { jobType: string; status: SyncStatus; message: string; startedAt: string; log?: string }
): Promise<SyncLogRecord | null> {
  const row = pickColumns(
    {
      job_type: payload.jobType,
      status: payload.status,
      message: payload.message,
      started_at: payload.startedAt,
      created_at: payload.startedAt,
      log: payload.log ?? payload.message,
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
  payload: { status: SyncStatus; message: string; finishedAt: string; errors: string[]; gamesSynced: number }
) {
  const row = pickColumns(
    {
      status: payload.status,
      message: payload.message,
      finished_at: payload.finishedAt,
      updated_at: payload.finishedAt,
      log: payload.message,
      errors: payload.errors.length ? payload.errors.join(' | ') : null,
      games_synced: payload.gamesSynced,
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

async function upsertPlayerMetrics(supabase: SupabaseClient, playerId: number) {
  const { data: stats } = await supabase
    .from('player_stats')
    .select('points,rebounds,assists,three_pointers,fgm,fga,minutes,is_home,game_date,steals,blocks,fg2a,fg3a,three_pa')
    .eq('player_id', playerId)
    .order('game_date', { ascending: false })
    .limit(30);

  if (!stats?.length) return;

  const metricMap: Record<string, number[]> = {
    points: stats.map((row) => toNumber(row.points)),
    rebounds: stats.map((row) => toNumber(row.rebounds)),
    assists: stats.map((row) => toNumber(row.assists)),
    three_pointers: stats.map((row) => toNumber(row.three_pointers)),
    fgm: stats.map((row) => toNumber(row.fgm)),
    fga: stats.map((row) => toNumber(row.fga)),
    steals: stats.map((row) => toNumber(row.steals)),
    blocks: stats.map((row) => toNumber(row.blocks)),
    fg2a: stats.map((row) => toNumber(row.fg2a)),
    fg3a: stats.map((row) => toNumber(row.fg3a || row.three_pa)),
  };

  for (const [stat, values] of Object.entries(metricMap)) {
    const recent = values.slice(0, 10);
    const line = avg(recent);

    await supabase.from('player_metrics').upsert(
      {
        player_id: playerId,
        stat,
        avg_l5: avg(values.slice(0, 5)),
        avg_l10: avg(recent),
        avg_l20: avg(values.slice(0, 20)),
        avg_home: avg(stats.filter((row) => row.is_home === true).map((row) => toNumber((row as Record<string, unknown>)[stat]))),
        avg_away: avg(stats.filter((row) => row.is_home === false).map((row) => toNumber((row as Record<string, unknown>)[stat]))),
        line,
        updated_at: nowIso(),
      },
      { onConflict: 'player_id,stat' }
    );
  }
}

async function runSyncCore(supabase: SupabaseClient, signal: AbortSignal): Promise<Omit<SyncSummary, 'startedAt' | 'finishedAt'>> {
  const apiProvider = createApiProvider(signal);
  const isMock = apiProvider.source === 'mock';
  const now = new Date();
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
  for (const dayGames of gamesPerDay) {
    for (const game of dayGames.games) {
      uniqueGameMap.set(game.id, { day: dayGames.day, game });
    }
  }

  const normalizedGames = [...uniqueGameMap.values()].map((entry) => normalizeGame(entry.game, entry.day));
  if (normalizedGames.length > 0) {
    const { error } = await supabase.from('games').upsert(normalizedGames, {
      onConflict: 'game_date,home_team,away_team',
    });

    if (error) {
      throw new Error(`games upsert failed: ${error.message}`);
    }
  }

  const teamIds = new Set<number>();
  for (const entry of uniqueGameMap.values()) {
    const home = toNumber(entry.game.teams?.home?.id);
    const away = toNumber(entry.game.teams?.visitors?.id);
    if (home > 0) teamIds.add(home);
    if (away > 0) teamIds.add(away);
  }

  const season = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const selectedTeamIds = isMock ? [...teamIds].slice(0, MOCK_MAX_TEAMS) : [...teamIds];
  let playersSynced = 0;
  let playerStatsSynced = 0;

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

    const { error: playerUpsertError } = await supabase.from('players').upsert(normalizedPlayers, { onConflict: 'api_id' });
    if (playerUpsertError) {
      throw new Error(`players upsert failed for team ${teamId}: ${playerUpsertError.message}`);
    }

    const apiIds = normalizedPlayers.map((player) => player.api_id);
    const { data: playerRows } = await supabase.from('players').select('id,api_id').in('api_id', apiIds);
    const playerIdByApi = new Map<number, number>((playerRows || []).map((row) => [toNumber(row.api_id), toNumber(row.id)]));

    for (const normalizedPlayer of normalizedPlayers) {
      const internalPlayerId = playerIdByApi.get(normalizedPlayer.api_id);
      if (!internalPlayerId) continue;

      const statsRows = (await apiProvider.getPlayerStatistics(normalizedPlayer.api_id, season, signal))
        .map((stat) => normalizePlayerStat(internalPlayerId, stat))
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
          throw new Error(`player_stats upsert failed for player ${normalizedPlayer.api_id}: ${statsUpsertError.message}`);
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
          throw new Error(`player_stats insert fallback failed for player ${normalizedPlayer.api_id}: ${statsInsertError.message}`);
        }
      }

      playerStatsSynced += statsRows.length;
      if (!isMock) {
        await upsertPlayerMetrics(supabase, internalPlayerId);
      }
    }
  }

  invalidateCacheByPrefix('games:');
  invalidateCacheByPrefix('players:');
  invalidateCacheByPrefix('metrics:');
  invalidateCacheByPrefix('admin:');

  return {
    status: 'success',
    message: `Sync (${apiProvider.source}) finished with ${normalizedGames.length} games, ${playersSynced} players and ${playerStatsSynced} player_stats upserted.${isMock ? ' Mock mode uses reduced team/player/stat volume and skips player_metrics writes.' : ''}`,
    gamesSynced: normalizedGames.length,
    teamsSynced: selectedTeamIds.length,
    playersSynced,
    playerStatsSynced,
    errors: [],
  };
}

export async function runNbaSyncJob(options: RunNbaSyncOptions = {}): Promise<SyncSummary> {
  const debugBase = {
    requestId: options.requestId ?? null,
    routeSource: options.routeSource ?? null,
  };

  if (inProcessRun) {
    const timestamp = nowIso();
    return {
      status: 'skipped',
      message: 'Sync skipped because another run is already in progress.',
      gamesSynced: 0,
      teamsSynced: 0,
      playersSynced: 0,
      playerStatsSynced: 0,
      errors: [],
      startedAt: timestamp,
      finishedAt: timestamp,
      debug: {
        ...debugBase,
        hasRunningSync: null,
        inProcessRunAlready: true,
        distributedLock: null,
      },
    };
  }

  inProcessRun = true;
  const startedAt = nowIso();
  const lockValue = `${startedAt}:${Math.random().toString(36).slice(2)}`;
  const lockTtlSeconds = Math.ceil((SYNC_TIMEOUT_MS + 2 * 60_000) / 1000);
  let distributedLockAcquired = false;
  let distributedLockState: 'acquired' | 'locked' | 'unavailable' | null = null;
  let hasRunningSyncResult: boolean | null = null;

  if (upstashAvailable()) {
    const lockState = await upstashSetNxEx(REDIS_SYNC_LOCK_KEY, lockValue, lockTtlSeconds);
    distributedLockState = lockState;
    if (lockState === 'locked') {
      const recoveryResult = await tryRecoverStaleDistributedLock(lockValue);
      if (recoveryResult === 'missing') {
        const retryLockState = await upstashSetNxEx(REDIS_SYNC_LOCK_KEY, lockValue, lockTtlSeconds);
        distributedLockState = retryLockState;
        if (retryLockState === 'acquired') {
          distributedLockAcquired = true;
        } else {
          const finishedAt = nowIso();
          inProcessRun = false;
          return {
            status: 'skipped',
            message: 'Sync skipped because another sync lock is active.',
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
              distributedLock: distributedLockState,
            },
          };
        }
      } else if (recoveryResult !== 'recovered') {
        const finishedAt = nowIso();
        inProcessRun = false;
        return {
          status: 'skipped',
          message: 'Sync skipped because another sync lock is active.',
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
            distributedLock: distributedLockState,
          },
        };
      } else {
        distributedLockAcquired = true;
      }
    } else {
      distributedLockAcquired = lockState === 'acquired';
    }
  } else {
    distributedLockState = 'unavailable';
  }

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const syncLogColumns = await detectTableColumns(supabase, 'sync_logs');

  let logId: string | number | null = null;

  try {
    hasRunningSyncResult = await hasRunningSync(supabase, syncLogColumns, now);
    if (hasRunningSyncResult) {
      const finishedAt = nowIso();
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
          distributedLock: distributedLockState,
        },
      };

      await updateSyncLog(supabase, syncLogColumns, null, {
        status: 'skipped',
        message: skippedSummary.message,
        finishedAt,
        errors: [],
        gamesSynced: 0,
      });
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
    });
    logId = log?.id ?? null;

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort('sync_timeout'), SYNC_TIMEOUT_MS);

    let partial: Omit<SyncSummary, 'startedAt' | 'finishedAt'>;
    try {
      partial = await runSyncCore(supabase, controller.signal);
    } finally {
      clearTimeout(timeoutHandle);
    }

    const finishedAt = nowIso();
    await updateSyncLog(supabase, syncLogColumns, logId, {
      status: partial.status,
      message: partial.message,
      finishedAt,
      errors: partial.errors,
      gamesSynced: partial.gamesSynced,
    });

    return {
      ...partial,
      startedAt,
      finishedAt,
      debug: {
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
      finishedAt,
      errors: [message],
      gamesSynced: 0,
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
    if (distributedLockAcquired) {
      await upstashDeleteIfValueMatches(REDIS_SYNC_LOCK_KEY, lockValue);
    }
    inProcessRun = false;
  }
}
