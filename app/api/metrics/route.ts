import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateSession, errorResponse, okResponse, corsHeaders } from '@/lib/security';
import { rateLimitDetailed, getIP } from '@/lib/rate-limit';
import { getCachedValue } from '@/lib/cache/memory-cache';
import { buildRequestContext, logHotPathRead, logRouteError, logSecurityEvent } from '@/lib/observability';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const FREE_STATS = ['PTS', '3PM'];
const ALL_STATS = ['PTS', 'AST', 'REB', '3PM', 'PA', 'PR', 'PRA', 'AR', 'DD', 'TD', 'STEAL', 'BLOCKS', 'SB', 'FG2A', 'FG3A'];
const BINARY_OUTCOME_STATS = new Set(['DD', 'TD']);
const LEGACY_STAT_ALIASES: Record<string, string> = {
  'P+A': 'PA',
  'P+R': 'PR',
  'A+R': 'AR',
};

const SUPPORTED_WINDOWS = ['L5', 'L10', 'L20', 'L30', 'SEASON', 'CURRENT_SEASON', 'PREV_SEASON'] as const;
type MetricsWindow = (typeof SUPPORTED_WINDOWS)[number];

const SUPPORTED_SPLITS = ['ALL', 'HOME', 'AWAY'] as const;
type MetricsSplit = (typeof SUPPORTED_SPLITS)[number];
type PersistedMetricRow = {
  avg_l5?: number | null;
  avg_l10?: number | null;
  avg_l20?: number | null;
  avg_l30?: number | null;
  avg_season?: number | null;
};

// GET /api/metrics?playerId=xxx&stat=PTS — métricas de um jogador
export async function GET(req: Request) {
  const context = buildRequestContext(req, { route: '/api/metrics' });
  const startedAt = Date.now();
  try {
    const session = await validateSession(req);
    if (!session.valid) {
      logSecurityEvent('auth_failed', { ...context, reason: session.error || 'unauthorized' });
      return errorResponse('Não autorizado', 401);
    }

    const rate = await rateLimitDetailed(`metrics:${session.userId}:${getIP(req)}`, 120, 60000);
    if (!rate.allowed) {
      logSecurityEvent('route_rate_limited', { ...context, retryAfterSeconds: rate.retryAfterSeconds });
      return errorResponse('Muitas requisições', 429);
    }

    const { searchParams } = new URL(req.url);
    const playerId = searchParams.get('playerId');
    const stat = normalizeStat(searchParams.get('stat'));
    const window = normalizeWindow(searchParams.get('window') || searchParams.get('split'));
    const split = normalizeSplit(searchParams.get('location') || searchParams.get('venue') || searchParams.get('ha'));
    const opponent = normalizeOpponent(searchParams.get('opponent') || searchParams.get('vs'));
    const opponentTeamId = normalizeEntityId(searchParams.get('opponentTeamId'));
    const selectedGameId = normalizeEntityId(searchParams.get('gameId'));

    if (!playerId || !/^\d+$/.test(playerId)) return errorResponse('playerId inválido');

    if (session.plan === 'free' && !FREE_STATS.includes(stat)) {
      return errorResponse('Estatística disponível apenas no plano Pro', 403);
    }

    if (!ALL_STATS.includes(stat)) {
      return errorResponse('Estatística inválida');
    }

    const parsedPlayerId = parseInt(playerId, 10);
    const cacheKey = `metrics:${parsedPlayerId}:${stat}:${window}:${split}:${opponentTeamId || 0}:${selectedGameId || 0}:${opponent || 'all'}`;
    const payload = await getCachedValue(cacheKey, 2 * 60_000, async () => {
      const { allGames, persistedMetrics } = await loadPlayerMetricsBase(parsedPlayerId, stat);

      const filteredGames = applySplitAndOpponent(allGames, split, opponent, opponentTeamId, selectedGameId);
      const scopedGames = applyWindow(filteredGames, window);
      const scopedValues = scopedGames.map((row) => row.value);

      const metrics = buildRuntimeMetrics(parsedPlayerId, stat, allGames, filteredGames, scopedGames, scopedValues, persistedMetrics);

      return {
        metrics,
        games: scopedGames.map((row) => ({
          date: row.date,
          value: row.value,
          minutes: row.minutes,
        })),
        chartSeries: scopedGames.map((row) => ({
          date: row.date,
          value: row.value,
        })),
        recentGames: scopedGames.slice(0, 10).map((row) => ({
          date: row.date,
          value: row.value,
          minutes: row.minutes,
          opponent: row.opponent,
          is_home: row.is_home,
        })),
      };
    });

    logHotPathRead('/api/metrics', {
      requestId: context.requestId,
      userId: session.userId || null,
      cacheKey,
      cacheTtlMs: 2 * 60_000,
      durationMs: Date.now() - startedAt,
      rowCount: payload.games.length,
      playerId: parsedPlayerId,
      stat,
      window,
      split,
      opponent: opponent || 'all',
    });

    return okResponse({
      metrics: payload.metrics,
      games: payload.games,
      chartSeries: payload.chartSeries,
      recentGames: payload.recentGames,
      stat,
      window,
      split,
      opponent,
      availableStats: session.plan === 'pro' ? ALL_STATS : FREE_STATS,
    });
  } catch (error) {
    logRouteError('/api/metrics', context.requestId, error, { status: 500, provider: 'supabase' });
    return errorResponse('Erro ao buscar métricas', 500);
  }
}

async function loadPlayerMetricsBase(playerId: number, stat: string): Promise<{ allGames: RuntimeGame[]; persistedMetrics: PersistedMetricRow | null }> {
  return getCachedValue(`metrics-base:${playerId}:${stat}`, 5 * 60_000, async () => {
    const [statsResult, persistedResult] = await Promise.all([
      supabase
        .from('player_stats')
        .select('game_id,game_date,minutes,is_home,opponent,points,rebounds,assists,three_pointers,fga,steals,blocks,fg2a,fg3a,three_pa')
        .eq('player_id', playerId)
        .order('game_date', { ascending: false })
        .limit(300),
      supabase
        .from('player_metrics')
        .select('avg_l5,avg_l10,avg_l20,avg_l30,avg_season')
        .eq('player_id', playerId)
        .eq('stat', stat)
        .maybeSingle(),
    ]);

    if (statsResult.error) throw statsResult.error;
    if (persistedResult.error) throw persistedResult.error;

    const allGames = (statsResult.data || []).map((row) => ({
      game_id: asNumber(row.game_id) || null,
      date: row.game_date,
      opponent: row.opponent?.trim() || null,
      is_home: row.is_home ?? null,
      value: getStatValue(row, stat),
      minutes: row.minutes,
    }));

    return {
      allGames,
      persistedMetrics: (persistedResult.data || null) as PersistedMetricRow | null,
    };
  });
}

function normalizeStat(rawStat: string | null): string {
  const stat = (rawStat || 'PTS').toUpperCase();
  return LEGACY_STAT_ALIASES[stat] || stat;
}

function normalizeWindow(rawWindow: string | null): MetricsWindow {
  const value = (rawWindow || 'L10').toUpperCase();
  return SUPPORTED_WINDOWS.includes(value as MetricsWindow) ? (value as MetricsWindow) : 'L10';
}

function normalizeSplit(rawSplit: string | null): MetricsSplit {
  const value = (rawSplit || 'ALL').toUpperCase();
  return SUPPORTED_SPLITS.includes(value as MetricsSplit) ? (value as MetricsSplit) : 'ALL';
}

function normalizeOpponent(rawOpponent: string | null): string | null {
  const value = rawOpponent?.trim();
  return value ? value.toLowerCase() : null;
}

function normalizeEntityId(rawValue: string | null): number | null {
  if (!rawValue || !/^\d+$/.test(rawValue)) return null;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

type PlayerStatRow = {
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  three_pointers: number | null;
  fga: number | null;
  steals?: number | null;
  blocks?: number | null;
  fg2a?: number | null;
  fg3a?: number | null;
  three_pa?: number | null;
  is_home?: boolean | null;
  game_date?: string | null;
  minutes?: number | null;
  opponent?: string | null;
};

type RuntimeGame = {
  game_id?: number | null;
  date: string | null;
  opponent: string | null;
  is_home: boolean | null;
  value: number;
  minutes: number | null;
};

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getFg3a(s: PlayerStatRow): number {
  const fg3a = asNumber(s.fg3a);
  if (fg3a > 0) return fg3a;
  return asNumber(s.three_pa);
}

function getFg2a(s: PlayerStatRow): number {
  const fg2a = asNumber(s.fg2a);
  if (fg2a > 0) return fg2a;
  const fga = asNumber(s.fga);
  const fg3a = getFg3a(s);
  if (fga > 0 && fg3a >= 0) return Math.max(0, fga - fg3a);
  return 0;
}

function getStatValue(s: PlayerStatRow, stat: string): number {
  const points = asNumber(s.points);
  const rebounds = asNumber(s.rebounds);
  const assists = asNumber(s.assists);
  const steals = asNumber(s.steals);
  const blocks = asNumber(s.blocks);

  switch (stat) {
    case 'PTS': return points;
    case 'REB': return rebounds;
    case 'AST': return assists;
    case '3PM': return asNumber(s.three_pointers);
    case 'PA': return points + assists;
    case 'PR': return points + rebounds;
    case 'PRA': return points + rebounds + assists;
    case 'AR': return assists + rebounds;
    case 'DD': {
      const categories = [points, rebounds, assists, steals, blocks].filter((v) => v >= 10).length;
      return categories >= 2 ? 1 : 0;
    }
    case 'TD': {
      const categories = [points, rebounds, assists, steals, blocks].filter((v) => v >= 10).length;
      return categories >= 3 ? 1 : 0;
    }
    case 'STEAL': return steals;
    case 'BLOCKS': return blocks;
    case 'SB': return steals + blocks;
    case 'FG2A': return getFg2a(s);
    case 'FG3A': return getFg3a(s);
    default: return 0;
  }
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return Number((values.reduce((acc, value) => acc + value, 0) / values.length).toFixed(1));
}

function applySplitAndOpponent(
  rows: RuntimeGame[],
  split: MetricsSplit,
  opponent: string | null,
  _opponentTeamId: number | null,
  selectedGameId: number | null,
): RuntimeGame[] {
  const normalizedOpponent = normalizeOpponentForH2H(opponent);
  return rows.filter((row) => {
    if (split === 'HOME' && row.is_home !== true) return false;
    if (split === 'AWAY' && row.is_home !== false) return false;
    if (selectedGameId && row.game_id === selectedGameId) return false;
    if (normalizedOpponent && normalizeOpponentForH2H(row.opponent) !== normalizedOpponent) return false;
    return true;
  });
}

function normalizeOpponentForH2H(value: string | null | undefined): string {
  const normalized = (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return TEAM_OPPONENT_ALIASES[normalized] || normalized;
}

const TEAM_OPPONENT_ALIASES: Record<string, string> = {
  hawks: 'atlantahawks',
  atlantahawks: 'atlantahawks',
  celtics: 'bostonceltics',
  bostonceltics: 'bostonceltics',
  nets: 'brooklynnets',
  brooklynnets: 'brooklynnets',
  hornets: 'charlottehornets',
  charlottehornets: 'charlottehornets',
  bulls: 'chicagobulls',
  chicagobulls: 'chicagobulls',
  cavaliers: 'clevelandcavaliers',
  clevelandcavaliers: 'clevelandcavaliers',
  mavericks: 'dallasmavericks',
  dallasmavericks: 'dallasmavericks',
  nuggets: 'denvernuggets',
  denvernuggets: 'denvernuggets',
  pistons: 'detroitpistons',
  detroitpistons: 'detroitpistons',
  warriors: 'goldenstatewarriors',
  goldenstatewarriors: 'goldenstatewarriors',
  rockets: 'houstonrockets',
  houstonrockets: 'houstonrockets',
  pacers: 'indianapacers',
  indianapacers: 'indianapacers',
  clippers: 'losangelesclippers',
  laclippers: 'losangelesclippers',
  losangelesclippers: 'losangelesclippers',
  lakers: 'losangeleslakers',
  lalakers: 'losangeleslakers',
  losangeleslakers: 'losangeleslakers',
  grizzlies: 'memphisgrizzlies',
  memphisgrizzlies: 'memphisgrizzlies',
  heat: 'miamiheat',
  miamiheat: 'miamiheat',
  bucks: 'milwaukeebucks',
  milwaukeebucks: 'milwaukeebucks',
  timberwolves: 'minnesotatimberwolves',
  minnesotatimberwolves: 'minnesotatimberwolves',
  pelicans: 'neworleanspelicans',
  neworleanspelicans: 'neworleanspelicans',
  knicks: 'newyorkknicks',
  newyorkknicks: 'newyorkknicks',
  thunder: 'oklahomacitythunder',
  oklahomacitythunder: 'oklahomacitythunder',
  magic: 'orlandomagic',
  orlandomagic: 'orlandomagic',
  sixers: 'philadelphia76ers',
  philadelphia76ers: 'philadelphia76ers',
  seventysixers: 'philadelphia76ers',
  suns: 'phoenixsuns',
  phoenixsuns: 'phoenixsuns',
  blazers: 'portlandtrailblazers',
  trailblazers: 'portlandtrailblazers',
  portlandtrailblazers: 'portlandtrailblazers',
  kings: 'sacramentokings',
  sacramentokings: 'sacramentokings',
  spurs: 'sanantoniospurs',
  sanantoniospurs: 'sanantoniospurs',
  raptors: 'torontoraptors',
  torontoraptors: 'torontoraptors',
  jazz: 'utahjazz',
  utahjazz: 'utahjazz',
  wizards: 'washingtonwizards',
  washingtonwizards: 'washingtonwizards',
};

function getSeasonStartYear(gameDate: string | null | undefined): number | null {
  if (!gameDate) return null;
  const parsed = new Date(gameDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const month = parsed.getUTCMonth() + 1;
  const year = parsed.getUTCFullYear();
  return month >= 9 ? year : year - 1;
}

function resolveCurrentSeasonStartYear(rows: RuntimeGame[]): number {
  const latestRowWithDate = rows.find((row) => Boolean(row.date));
  const latestSeason = latestRowWithDate ? getSeasonStartYear(latestRowWithDate.date) : null;
  if (latestSeason !== null) return latestSeason;
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  return month >= 9 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

function applyWindow(rows: RuntimeGame[], window: MetricsWindow): RuntimeGame[] {
  if (window === 'SEASON') return rows;
  if (window === 'CURRENT_SEASON' || window === 'PREV_SEASON') {
    const currentSeasonStart = resolveCurrentSeasonStartYear(rows);
    const targetSeasonStart = window === 'CURRENT_SEASON' ? currentSeasonStart : currentSeasonStart - 1;
    return rows.filter((row) => getSeasonStartYear(row.date) === targetSeasonStart);
  }
  const sizeMap: Record<Exclude<MetricsWindow, 'SEASON' | 'CURRENT_SEASON' | 'PREV_SEASON'>, number> = {
    L5: 5,
    L10: 10,
    L20: 20,
    L30: 30,
  };
  return rows.slice(0, sizeMap[window]);
}

function hitRate(values: number[], line: number): number {
  if (!values.length) return 0;
  const hits = values.filter((value) => value >= line).length;
  return Number(((hits / values.length) * 100).toFixed(1));
}

function resolveLineForStat(stat: string, rawLine: number): number {
  const minimumLine = BINARY_OUTCOME_STATS.has(stat) ? 0.5 : 0;
  if (!Number.isFinite(rawLine)) return minimumLine;
  return Math.max(minimumLine, Number(rawLine.toFixed(1)));
}

function buildRuntimeMetrics(
  playerId: number,
  stat: string,
  allGames: RuntimeGame[],
  filteredGames: RuntimeGame[],
  scopedGames: RuntimeGame[],
  scopedValues: number[],
  persistedMetrics: PersistedMetricRow | null,
) {
  const filteredValues = filteredGames.map((row) => row.value);
  const l10Values = filteredValues.slice(0, 10);
  const line = resolveLineForStat(stat, persistedMetrics?.avg_l10 ?? avg(l10Values));

  return {
    player_id: playerId,
    stat,
    avg_l5: resolveMetricValue(filteredValues.slice(0, 5), persistedMetrics?.avg_l5),
    avg_l10: resolveMetricValue(l10Values, persistedMetrics?.avg_l10),
    avg_l20: resolveMetricValue(filteredValues.slice(0, 20), persistedMetrics?.avg_l20),
    avg_l30: resolveMetricValue(filteredValues.slice(0, 30), persistedMetrics?.avg_l30),
    avg_season: resolveMetricValue(filteredValues, persistedMetrics?.avg_season),
    avg_home: avg(allGames.filter((row) => row.is_home === true).map((row) => row.value)),
    avg_away: avg(allGames.filter((row) => row.is_home === false).map((row) => row.value)),
    hit_rate_l10: hitRate(l10Values, line),
    line,
    sample_size: scopedGames.length,
    season_sample_size: filteredGames.length,
    selected_avg: avg(scopedValues),
    selected_hit_rate: hitRate(scopedValues, line),
  };
}

function resolveMetricValue(fallbackValues: number[], persistedValue: number | null | undefined): number {
  if (typeof persistedValue === 'number' && Number.isFinite(persistedValue)) {
    return Number(persistedValue.toFixed(1));
  }
  return avg(fallbackValues);
}

// OPTIONS
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}
