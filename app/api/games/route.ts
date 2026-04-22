import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateSession, sanitizeGame, errorResponse, okResponse, corsHeaders } from '@/lib/security';
import { rateLimitDetailed, getIP } from '@/lib/rate-limit';
import { getCachedValue } from '@/lib/cache/memory-cache';
import { buildRequestContext, logHotPathRead, logRouteError, logSecurityEvent } from '@/lib/observability';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type SaoPauloParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo';
const DASHBOARD_CUTOFF_HOUR = 4;
const WINDOW_START_MINUTE = 13 * 60;
const WINDOW_END_MINUTE = 40;

function getSaoPauloDateParts(date: Date): SaoPauloParts | null {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  return { year, month, day, hour, minute };
}

function toCalendarKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function plusDays(calendarKey: string, amount: number): string {
  const [year, month, day] = calendarKey.split('-').map(Number);
  if (!year || !month || !day) return calendarKey;

  const next = new Date(Date.UTC(year, month - 1, day + amount));
  return toCalendarKey(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

function resolveVisibleDashboardDayKey(now: Date, cutoffHour = DASHBOARD_CUTOFF_HOUR): string {
  const local = getSaoPauloDateParts(now);
  if (!local) return '';

  if (local.hour < cutoffHour) {
    const previousDay = new Date(Date.UTC(local.year, local.month - 1, local.day - 1));
    return toCalendarKey(previousDay.getUTCFullYear(), previousDay.getUTCMonth() + 1, previousDay.getUTCDate());
  }

  return toCalendarKey(local.year, local.month, local.day);
}

function parseGameTime(gameTime: string | null | undefined): Date | null {
  const value = gameTime?.trim();
  if (!value) return null;

  const hasTimezone = /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(value);
  if (hasTimezone) {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  const normalized = value.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) return null;

  return parsed;
}

function isInVisibleSlateWindow(gameTime: string | null | undefined, visibleDayKey: string): boolean {
  const parsed = parseGameTime(gameTime);
  if (!parsed) return false;

  const local = getSaoPauloDateParts(parsed);
  if (!local) return false;

  const nextDayKey = plusDays(visibleDayKey, 1);
  const gameDayKey = toCalendarKey(local.year, local.month, local.day);
  const minutes = local.hour * 60 + local.minute;

  if (gameDayKey === visibleDayKey) {
    return minutes >= WINDOW_START_MINUTE;
  }

  if (gameDayKey === nextDayKey) {
    return minutes <= WINDOW_END_MINUTE;
  }

  return false;
}

// GET /api/games — slate visível do dashboard (regra BRT)
export async function GET(req: Request) {
  const context = buildRequestContext(req, { route: '/api/games' });
  const startedAt = Date.now();
  const session = await validateSession(req);
  if (!session.valid) {
    logSecurityEvent('auth_failed', { ...context, reason: session.error || 'unauthorized' });
    return errorResponse('Não autorizado', 401);
  }

  const rate = await rateLimitDetailed(`games:${session.userId}:${getIP(req)}`, 50, 60000);
  if (!rate.allowed) {
    logSecurityEvent('route_rate_limited', { ...context, retryAfterSeconds: rate.retryAfterSeconds });
    return errorResponse('Muitas requisições', 429);
  }

  const visibleDay = resolveVisibleDashboardDayKey(new Date(), DASHBOARD_CUTOFF_HOUR);
  const nextDay = plusDays(visibleDay, 1);

  const result = await getCachedValue(`games:${visibleDay}:cutoff-${DASHBOARD_CUTOFF_HOUR}`, 30_000, async () => {
    const { data: games, error } = await supabase
      .from('games')
      .select('id, game_date, home_team, away_team, home_team_id, away_team_id, home_logo, away_logo, game_time, status')
      .in('game_date', [visibleDay, nextDay])
      .order('game_time');

    if (error) {
      throw error;
    }

    return (games || [])
      .filter((game) => isInVisibleSlateWindow(game.game_time, visibleDay))
      .map(sanitizeGame);
  }).catch((error) => {
    logRouteError('/api/games', context.requestId, error, { status: 500, provider: 'supabase', userId: session.userId || null });
    return null;
  });

  if (!result) return errorResponse('Erro ao buscar jogos', 500);

  logHotPathRead('/api/games', {
    requestId: context.requestId,
    userId: session.userId || null,
    cacheKey: `games:${visibleDay}:cutoff-${DASHBOARD_CUTOFF_HOUR}`,
    cacheTtlMs: 30_000,
    durationMs: Date.now() - startedAt,
    rowCount: result.length,
    visibleDay,
  });

  return okResponse({ games: result, date: visibleDay });
}

// OPTIONS — CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}
