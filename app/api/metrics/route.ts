import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateSession, sanitizeMetrics, errorResponse, okResponse, corsHeaders } from '@/lib/security';
import { rateLimit, getIP } from '@/lib/rate-limit';
import { getCachedValue } from '@/lib/cache/memory-cache';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const FREE_STATS = ['PTS'];
const ALL_STATS = ['PTS', 'REB', 'AST', '3PM', 'P+A', 'P+R', 'A+R', 'FG2A', 'FG3A'];

// GET /api/metrics?playerId=xxx&stat=PTS — métricas de um jogador
export async function GET(req: Request) {
  const session = await validateSession(req);
  if (!session.valid) return errorResponse('Não autorizado', 401);

  if (!await rateLimit(getIP(req), 60, 60000)) {
    return errorResponse('Muitas requisições', 429);
  }

  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get('playerId');
  const stat = searchParams.get('stat') || 'PTS';

  if (!playerId) return errorResponse('playerId obrigatório');

  // Plano Free: só PTS
  if (session.plan === 'free' && !FREE_STATS.includes(stat)) {
    return errorResponse('Estatística disponível apenas no plano Pro', 403);
  }

  // Validar stat — nunca aceitar input arbitrário do frontend
  if (!ALL_STATS.includes(stat)) {
    return errorResponse('Estatística inválida');
  }

  const parsedPlayerId = parseInt(playerId, 10);
  const payload = await getCachedValue(`metrics:${session.plan}:${parsedPlayerId}:${stat}`, 2 * 60_000, async () => {
    const { data: cache } = await supabase
      .from('player_props_cache')
      .select('*')
      .eq('player_id', parsedPlayerId)
      .eq('stat', stat)
      .single();

    let metrics = null;
    if (cache) {
      metrics = {
        player_id: cache.player_id,
        stat: cache.stat,
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
      const { data: m } = await supabase.from('player_metrics').select('*').eq('player_id', parsedPlayerId).eq('stat', stat).single();
      if (m) metrics = sanitizeMetrics(m);
    }

    const { data: recentStats } = await supabase
      .from('player_stats')
      .select('game_date, points, rebounds, assists, three_pointers, fgm, fga, minutes')
      .eq('player_id', parsedPlayerId)
      .order('game_date', { ascending: false })
      .limit(session.plan === 'free' ? 5 : 20);

    const games = (recentStats || []).map((row) => ({
      date: row.game_date,
      value: getStatValue(row, stat),
      minutes: row.minutes,
    }));

    return { metrics, games };
  });

  return okResponse({ metrics: payload.metrics, games: payload.games, stat, availableStats: session.plan === 'pro' ? ALL_STATS : FREE_STATS });
}

type PlayerStatRow = {
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  three_pointers: number | null;
  fgm: number | null;
  fga: number | null;
};

function getStatValue(s: PlayerStatRow, stat: string): number {
  switch (stat) {
    case 'PTS': return s.points || 0;
    case 'REB': return s.rebounds || 0;
    case 'AST': return s.assists || 0;
    case '3PM': return s.three_pointers || 0;
    case 'P+A': return (s.points || 0) + (s.assists || 0);
    case 'P+R': return (s.points || 0) + (s.rebounds || 0);
    case 'A+R': return (s.assists || 0) + (s.rebounds || 0);
    case 'FG2A': return s.fgm || 0;
    case 'FG3A': return s.fga || 0;
    default: return 0;
  }
}

// OPTIONS
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}
