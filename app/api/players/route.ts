import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateSession, sanitizePlayer, errorResponse, okResponse, corsHeaders } from '@/lib/security';
import { rateLimit, getIP } from '@/lib/rate-limit';
import { getCachedValue } from '@/lib/cache/memory-cache';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// GET /api/players?gameId=xxx — jogadores de um jogo
export async function GET(req: Request) {
  const session = await validateSession(req);
  if (!session.valid) return errorResponse('Não autorizado', 401);

  if (!await rateLimit(getIP(req), 60, 60000)) {
    return errorResponse('Muitas requisições', 429);
  }

  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get('gameId');
  if (!gameId || !/^\d+$/.test(gameId)) return errorResponse('gameId inválido');

  const result = await getCachedValue(`players:${gameId}:${session.plan}`, 5 * 60_000, async () => {
    const { data: game } = await supabase
      .from('games')
      .select('id, home_team_id, away_team_id, game_date')
      .eq('id', gameId)
      .single();

    if (!game) throw new Error('Jogo não encontrado');

    const { data: players } = await supabase
      .from('players')
      .select('id, name, team_id, position, jersey, photo')
      .in('team_id', [game.home_team_id, game.away_team_id])
      .order('name');

    let output = (players || []).map(sanitizePlayer);
    if (session.plan === 'free') {
      const homePlayer = output.find((player) => player.team_id === game.home_team_id);
      const awayPlayer = output.find((player) => player.team_id === game.away_team_id);
      output = [homePlayer, awayPlayer].filter(Boolean) as typeof output;
    }
    return output;
  }).catch((error) => {
    if (error instanceof Error && error.message === 'Jogo não encontrado') {
      return 'not_found' as const;
    }
    return null;
  });

  if (result === 'not_found') return errorResponse('Jogo não encontrado', 404);
  if (!result) return errorResponse('Erro ao buscar jogadores', 500);

  return okResponse({ players: result });
}

// OPTIONS — CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}
