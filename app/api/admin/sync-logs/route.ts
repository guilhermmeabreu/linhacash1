import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminUser } from '@/lib/auth/authorization';
import { AppError } from '@/lib/http/errors';
import { fail, internalError, options } from '@/lib/http/responses';
import { getCachedValue } from '@/lib/cache/memory-cache';
import { getIP, rateLimitDetailed } from '@/lib/rate-limit';
import { buildRequestContext, logRouteError, logSecurityEvent } from '@/lib/observability';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function GET(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  const context = buildRequestContext(req, { route: '/api/admin/sync-logs' });
  try {
    const admin = await requireAdminUser(req);
    const rate = await rateLimitDetailed(`admin:sync-logs:${admin.email}:${getIP(req)}`, 45, 60_000);
    if (!rate.allowed) {
      logSecurityEvent('route_rate_limited', { ...context, adminEmail: admin.email, retryAfterSeconds: rate.retryAfterSeconds });
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many admin sync-log requests'), origin);
    }
    const data = await getCachedValue('admin:sync-logs', 30_000, async () => {
      const { data: rows } = await supabase.from('sync_logs').select('*').order('created_at', { ascending: false }).limit(5);
      return rows || [];
    });
    return NextResponse.json(data || []);
  } catch (error) {
    if (error instanceof AppError) {
      logRouteError('/api/admin/sync-logs', context.requestId, error, { status: error.status, code: error.code });
      return fail(error, origin);
    }
    logRouteError('/api/admin/sync-logs', context.requestId, error, { status: 500 });
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
