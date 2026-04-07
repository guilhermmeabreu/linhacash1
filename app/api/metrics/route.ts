import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateSession, sanitizeMetrics, errorResponse, okResponse, corsHeaders } from '@/lib/security';
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
  const payload = await getCachedValue(`metrics:${session.plan}:${parsedPlayerId}:${stat}`, 2 * 60_000, async () => {
    const storageStat = getStorageStat(stat);

    let metrics = null;
    if (storageStat) {
      const { data: cache } = await supabase
        .from('player_props_cache')
        .select('*')
        .eq('player_id', parsedPlayerId)
        .eq('stat', storageStat)
        .single();

      if (cache) {
        metrics = {
          player_id: cache.player_id,
          stat,
          avg_l5: cache.avg_l5,
          avg_l10: cache.avg_l10,
          avg_l20: cache.avg_l20,
          avg_l30: cache.avg_l20,
          avg_home: cache.avg_home,
          avg_away: cache.avg_away,
          hit_rate_l10: cache.hit_rate_l10,
          confidence_score: cache.confidence_score,
        };
      } else {
        const { data: m } = await supabase
          .from('player_metrics')
          .select('*')
          .eq('player_id', parsedPlayerId)
          .eq('stat', storageStat)
          .single();
        if (m) {
          metrics = {
            ...sanitizeMetrics(m),
            stat,
          };
        }
      }
    }

    const { data: recentStats } = await supabase
      .from('player_stats')
      .select('*')
      .eq('player_id', parsedPlayerId)
      .order('game_date', { ascending: false })
      .limit(session.plan === 'free' ? 5 : 20);

    const values = (recentStats || []).map((row) => getStatValue(row, stat));
    if (!metrics && values.length > 0) {
      metrics = buildDerivedMetrics(parsedPlayerId, stat, recentStats || [], values);
    }

    const games = (recentStats || []).map((row) => ({
      date: row.game_date,
      value: getStatValue(row, stat),
      minutes: row.minutes,
    }));

    return { metrics, games };
  });

  return okResponse({ metrics: payload.metrics, games: payload.games, stat, availableStats: session.plan === 'pro' ? ALL_STATS : FREE_STATS });
}

function normalizeStat(rawStat: string | null): string {
  const stat = (rawStat || 'PTS').toUpperCase();
  return LEGACY_STAT_ALIASES[stat] || stat;
}

function getStorageStat(stat: string): string | null {
  switch (stat) {
    case 'PTS': return 'points';
    case 'REB': return 'rebounds';
    case 'AST': return 'assists';
    case '3PM': return 'three_pointers';
    case 'FG3A': return 'fg3a';
    case 'FG2A': return 'fg2a';
    case 'STEAL': return 'steals';
    case 'BLOCKS': return 'blocks';
    default: return null;
  }
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

function buildDerivedMetrics(playerId: number, stat: string, rows: PlayerStatRow[], values: number[]) {
  const l10 = values.slice(0, 10);
  const line = avg(l10);
  const hitRate = l10.length > 0
    ? Number(((l10.filter((value) => value > line).length / l10.length) * 100).toFixed(1))
    : 0;

  return {
    player_id: playerId,
    stat,
    avg_l5: avg(values.slice(0, 5)),
    avg_l10: line,
    avg_l20: avg(values),
    avg_l30: avg(values),
    avg_home: avg(rows.filter((row) => row.is_home).map((row) => getStatValue(row, stat))),
    avg_away: avg(rows.filter((row) => !row.is_home).map((row) => getStatValue(row, stat))),
    hit_rate_l10: hitRate,
    line,
  };
}

// OPTIONS
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}
