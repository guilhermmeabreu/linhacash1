import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateSession, errorResponse, okResponse, corsHeaders } from '@/lib/security';
import { rateLimitDetailed, getIP } from '@/lib/rate-limit';
import { getCachedValue } from '@/lib/cache/memory-cache';
import { buildRequestContext, logRouteError, logSecurityEvent } from '@/lib/observability';

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

const SUPPORTED_WINDOWS = ['L5', 'L10', 'L20', 'L30', 'SEASON', 'CURRENT_SEASON', 'PREV_SEASON'] as const;
type MetricsWindow = (typeof SUPPORTED_WINDOWS)[number];

const SUPPORTED_SPLITS = ['ALL', 'HOME', 'AWAY'] as const;
type MetricsSplit = (typeof SUPPORTED_SPLITS)[number];

// GET /api/metrics?playerId=xxx&stat=PTS — métricas de um jogador
export async function GET(req: Request) {
  const context = buildRequestContext(req, { route: '/api/metrics' });
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

    if (!playerId || !/^\d+$/.test(playerId)) return errorResponse('playerId inválido');

    if (session.plan === 'free' && !FREE_STATS.includes(stat)) {
      return errorResponse('Estatística disponível apenas no plano Pro', 403);
    }

    if (!ALL_STATS.includes(stat)) {
      return errorResponse('Estatística inválida');
    }

    const parsedPlayerId = parseInt(playerId, 10);
    const cacheKey = `metrics:${session.plan}:${parsedPlayerId}:${stat}:${window}:${split}:${opponent || 'all'}`;
    const payload = await getCachedValue(cacheKey, 2 * 60_000, async () => {
      const { data: playerRow } = await supabase
        .from('players')
        .select('team_id')
        .eq('id', parsedPlayerId)
        .maybeSingle();
      const playerTeamId = asNumber(playerRow?.team_id) || null;

      const { data: recentStats, error } = await supabase
        .from('player_stats')
        .select('game_id,game_date,minutes,is_home,opponent,points,rebounds,assists,three_pointers,fgm,fga,steals,blocks,fg2a,fg3a,three_pa')
        .eq('player_id', parsedPlayerId)
        .order('game_date', { ascending: false })
        .limit(120);

      if (error) throw error;

      const gameIds = Array.from(new Set((recentStats || [])
        .map((row) => asNumber(row.game_id))
        .filter((value) => value > 0)));
      const gameById = new Map<number, { home_team: string | null; away_team: string | null; home_team_id: number | null; away_team_id: number | null }>();
      if (gameIds.length) {
        const { data: gamesRows, error: gamesError } = await supabase
          .from('games')
          .select('id,home_team,away_team,home_team_id,away_team_id')
          .in('id', gameIds);
        if (gamesError) throw gamesError;
        (gamesRows || []).forEach((game) => {
          const gameId = asNumber(game.id);
          if (!gameId) return;
          gameById.set(gameId, {
            home_team: game.home_team || null,
            away_team: game.away_team || null,
            home_team_id: asNumber(game.home_team_id) || null,
            away_team_id: asNumber(game.away_team_id) || null,
          });
        });
      }

      const allGames = (recentStats || []).map((row) => ({
        game_id: asNumber(row.game_id) || null,
        date: row.game_date,
        opponent: resolveOpponentName(row, playerTeamId, gameById),
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
  } catch (error) {
    logRouteError('/api/metrics', context.requestId, error, { status: 500, provider: 'supabase' });
    return errorResponse('Erro ao buscar métricas', 500);
  }
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

function applySplitAndOpponent(rows: RuntimeGame[], split: MetricsSplit, opponent: string | null): RuntimeGame[] {
  const normalizedOpponent = opponent ? opponent.trim().toLowerCase() : null;
  const opponentHints = buildTeamMatchHints(normalizedOpponent);
  return rows.filter((row) => {
    if (split === 'HOME' && row.is_home !== true) return false;
    if (split === 'AWAY' && row.is_home !== false) return false;
    if (normalizedOpponent && !matchesOpponent(row.opponent, opponentHints)) return false;
    return true;
  });
}

function normalizeTeamToken(value: string | null | undefined): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function buildTeamMatchHints(team: string | null | undefined): string[] {
  const raw = (team || '').trim();
  if (!raw) return [];
  const compact = normalizeTeamToken(raw);
  const parts = raw.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const initials = parts.map((part) => part[0]).join('');
  const nickname = parts.at(-1) || '';
  const city = parts[0] || '';
  const cityAbbrev = city.slice(0, 3);
  const nicknameAbbrev = nickname.slice(0, 3);
  return Array.from(new Set([compact, initials, nickname, cityAbbrev, nicknameAbbrev].filter(Boolean)));
}

function matchesOpponent(candidate: string | null | undefined, opponentHints: string[]): boolean {
  if (!opponentHints.length) return true;
  const candidateHints = buildTeamMatchHints(candidate);
  if (!candidateHints.length) return false;
  return candidateHints.some((candidateHint) =>
    opponentHints.some((opponentHint) =>
      candidateHint === opponentHint || candidateHint.includes(opponentHint) || opponentHint.includes(candidateHint)));
}

function resolveOpponentName(
  row: { game_id?: number | null; opponent?: string | null; is_home?: boolean | null },
  playerTeamId: number | null,
  gameById: Map<number, { home_team: string | null; away_team: string | null; home_team_id: number | null; away_team_id: number | null }>,
): string | null {
  const explicitOpponent = row.opponent?.trim() || null;
  const gameId = asNumber(row.game_id) || null;
  if (!gameId) return explicitOpponent;
  const game = gameById.get(gameId);
  if (!game) return explicitOpponent;

  if (row.is_home === true && game.away_team) return game.away_team;
  if (row.is_home === false && game.home_team) return game.home_team;

  if (playerTeamId && game.home_team_id && playerTeamId === game.home_team_id && game.away_team) return game.away_team;
  if (playerTeamId && game.away_team_id && playerTeamId === game.away_team_id && game.home_team) return game.home_team;

  return explicitOpponent;
}

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
    avg_season: avg(filteredValues),
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
