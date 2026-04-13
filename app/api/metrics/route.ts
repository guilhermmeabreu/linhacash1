import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateSession, errorResponse, okResponse, corsHeaders } from '@/lib/security';
import { rateLimitDetailed, getIP } from '@/lib/rate-limit';
import { getCachedValue } from '@/lib/cache/memory-cache';
import { buildRequestContext, logSecurityEvent } from '@/lib/observability';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const FREE_STATS = ['PTS', '3PM'];
const ALL_STATS = ['PTS', 'AST', 'REB', '3PM', 'PA', 'PR', 'PRA', 'AR', 'DD', 'TD', 'STEAL', 'BLOCKS', 'SB', 'FG2A', 'FG3A'];
const LEGACY_STAT_ALIASES: Record<string, string> = {
  'P+A': 'PA',
  'P+R': 'PR',
  'A+R': 'AR',
};

const SUPPORTED_WINDOWS = ['L5', 'L10', 'L20', 'L30', 'SEASON'] as const;
type MetricsWindow = (typeof SUPPORTED_WINDOWS)[number];

const SUPPORTED_SPLITS = ['ALL', 'HOME', 'AWAY'] as const;
type MetricsSplit = (typeof SUPPORTED_SPLITS)[number];

// GET /api/metrics?playerId=xxx&stat=PTS — métricas de um jogador
export async function GET(req: Request) {
  const context = buildRequestContext(req, { route: '/api/metrics' });
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

  if (!playerId || !/^\d+$/.test(playerId)) return errorResponse('playerId inválido');

  // Plano Free: PTS + 3PM
  if (session.plan === 'free' && !FREE_STATS.includes(stat)) {
    return errorResponse('Estatística disponível apenas no plano Pro', 403);
  }

  // Validar stat — nunca aceitar input arbitrário do frontend
  if (!ALL_STATS.includes(stat)) {
    return errorResponse('Estatística inválida');
  }

  const parsedPlayerId = parseInt(playerId, 10);
  const cacheKey = `metrics:${session.plan}:${parsedPlayerId}:${stat}:${window}:${split}:${opponent || 'all'}`;
  const payload = await getCachedValue(cacheKey, 2 * 60_000, async () => {
    const { data: recentStats, error } = await supabase
      .from('player_stats')
      .select('game_date,minutes,is_home,opponent,points,rebounds,assists,three_pointers,fgm,fga,steals,blocks,fg2a,fg3a,three_pa')
      .eq('player_id', parsedPlayerId)
      .order('game_date', { ascending: false })
      .limit(120);

    if (error) {
      throw new Error(`player_stats query failed: ${error.message}`);
    }

    const allGames = (recentStats || []).map((row) => ({
      date: row.game_date,
      opponent: row.opponent ?? null,
      is_home: row.is_home ?? null,
      value: getStatValue(row, stat),
      minutes: row.minutes,
    }));

    const filteredGames = applySplitAndOpponent(allGames, split, opponent);
    const scopedGames = applyWindow(filteredGames, window);
    const scopedValues = scopedGames.map((row) => row.value);

    const metrics = buildRuntimeMetrics(parsedPlayerId, stat, allGames, filteredGames, scopedGames, scopedValues);

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

type PlayerStatRow = {
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  three_pointers: number | null;
  fgm: number | null;
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

function applySplitAndOpponent(rows: RuntimeGame[], split: MetricsSplit, opponent: string | null): RuntimeGame[] {
  const normalizedOpponent = opponent ? opponent.trim().toLowerCase() : null;
  return rows.filter((row) => {
    if (split === 'HOME' && row.is_home !== true) return false;
    if (split === 'AWAY' && row.is_home !== false) return false;
    if (normalizedOpponent && !(row.opponent || '').trim().toLowerCase().includes(normalizedOpponent)) return false;
    return true;
  });
}

function applyWindow(rows: RuntimeGame[], window: MetricsWindow): RuntimeGame[] {
  if (window === 'SEASON') return rows;
  const sizeMap: Record<Exclude<MetricsWindow, 'SEASON'>, number> = {
    L5: 5,
    L10: 10,
    L20: 20,
    L30: 30,
  };
  return rows.slice(0, sizeMap[window]);
}

function hitRate(values: number[], line: number): number {
  if (!values.length) return 0;
  const hits = values.filter((value) => value > line).length;
  return Number(((hits / values.length) * 100).toFixed(1));
}

function buildRuntimeMetrics(
  playerId: number,
  stat: string,
  allGames: RuntimeGame[],
  filteredGames: RuntimeGame[],
  scopedGames: RuntimeGame[],
  scopedValues: number[],
) {
  const filteredValues = filteredGames.map((row) => row.value);
  const l10Values = filteredValues.slice(0, 10);
  const line = avg(l10Values);

  return {
    player_id: playerId,
    stat,
    avg_l5: avg(filteredValues.slice(0, 5)),
    avg_l10: line,
    avg_l20: avg(filteredValues.slice(0, 20)),
    avg_l30: avg(filteredValues.slice(0, 30)),
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

// OPTIONS
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}
