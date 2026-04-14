import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateSession, sanitizeGame, errorResponse, okResponse, corsHeaders } from '@/lib/security';
import { rateLimitDetailed, getIP } from '@/lib/rate-limit';
import { getCachedValue } from '@/lib/cache/memory-cache';
import { buildRequestContext, logRouteError, logSecurityEvent } from '@/lib/observability';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// GET /api/games — jogos do dia
export async function GET(req: Request) {
  const context = buildRequestContext(req, { route: '/api/games' });
  // Verificar sessão
  const session = await validateSession(req);
  if (!session.valid) {
    logSecurityEvent('auth_failed', { ...context, reason: session.error || 'unauthorized' });
    return errorResponse('Não autorizado', 401);
  }

  // Rate limit
  const rate = await rateLimitDetailed(`games:${session.userId}:${getIP(req)}`, 50, 60000);
  if (!rate.allowed) {
    logSecurityEvent('route_rate_limited', { ...context, retryAfterSeconds: rate.retryAfterSeconds });
    return errorResponse('Muitas requisições', 429);
  }

  // Calcular data de hoje em BRT
  const brOffset = -3 * 60 * 60 * 1000;
  const nowBR = new Date(Date.now() + brOffset);
  const today = nowBR.toISOString().split('T')[0];

  const result = await getCachedValue(`games:${today}`, 30_000, async () => {
    const { data: games, error } = await supabase
      .from('games')
      .select('id, game_date, home_team, away_team, home_team_id, away_team_id, home_logo, away_logo, game_time, status')
      .eq('game_date', today)
      .order('game_time');

    if (error) {
      throw error;
    }

    return (games || []).map(sanitizeGame);
  }).catch((error) => {
    logRouteError('/api/games', context.requestId, error, { status: 500, provider: 'supabase', userId: session.userId || null });
    return null;
  });

  if (!result) return errorResponse('Erro ao buscar jogos', 500);

  return okResponse({ games: result, date: today });
}

// OPTIONS — CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}
