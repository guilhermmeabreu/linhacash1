import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateSession, sanitizeGame, errorResponse, okResponse, corsHeaders } from '@/lib/security';
import { rateLimit, getIP } from '@/lib/rate-limit';
import { getCachedValue } from '@/lib/cache/memory-cache';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// GET /api/games — jogos do dia
export async function GET(req: Request) {
  // Verificar sessão
  const session = await validateSession(req);
  if (!session.valid) return errorResponse('Não autorizado', 401);

  // Rate limit
  if (!await rateLimit(getIP(req), 30, 60000)) {
    return errorResponse('Muitas requisições', 429);
  }

  // Calcular data de hoje em BRT
  const brOffset = -3 * 60 * 60 * 1000;
  const nowBR = new Date(Date.now() + brOffset);
  const today = nowBR.toISOString().split('T')[0];

  const result = await getCachedValue(`games:${today}:${session.plan}`, 30_000, async () => {
    const { data: games, error } = await supabase
      .from('games')
      .select('id, game_date, home_team, away_team, home_team_id, away_team_id, home_logo, away_logo, game_time, status')
      .eq('game_date', today)
      .order('game_time');

    if (error) {
      console.error('[/api/games] Error:', error.message);
      throw new Error('Erro ao buscar jogos');
    }

    let output = (games || []).map(sanitizeGame);
    if (session.plan === 'free') {
      output = output.slice(0, 1);
    }
    return output;
  }).catch(() => null);

  if (!result) return errorResponse('Erro ao buscar jogos', 500);

  return okResponse({ games: result, date: today });
}

// OPTIONS — CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}
