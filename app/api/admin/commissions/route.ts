import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminUser } from '@/lib/auth/authorization';
import { AppError } from '@/lib/http/errors';
import { fail, internalError, options } from '@/lib/http/responses';
import { asNumber, asString, ensureObject } from '@/lib/validators/common';
import { getCachedValue, invalidateCacheByPrefix } from '@/lib/cache/memory-cache';
import { getIP, rateLimitDetailed } from '@/lib/rate-limit';
import { buildRequestContext, logRouteError, logSecurityEvent } from '@/lib/observability';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const ALLOWED_STATUSES = new Set(['pending', 'earned', 'paid']);

async function enforceAdminRate(req: Request, adminEmail: string, action: string, limit = 35) {
  return rateLimitDetailed(`admin:commissions:${action}:${adminEmail}:${getIP(req)}`, limit, 60_000);
}

export async function GET(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  const context = buildRequestContext(req, { route: '/api/admin/commissions', method: 'GET' });
  try {
    const admin = await requireAdminUser(req);
    const rate = await enforceAdminRate(req, admin.email, 'get', 45);
    if (!rate.allowed) {
      logSecurityEvent('route_rate_limited', { ...context, adminEmail: admin.email, retryAfterSeconds: rate.retryAfterSeconds });
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many admin commission list requests'), origin);
    }
    const data = await getCachedValue('admin:commissions', 30_000, async () => {
      const { data: rows } = await supabase.from('affiliate_commissions').select('*').order('created_at', { ascending: false });
      return rows || [];
    });
    return NextResponse.json(data || []);
  } catch (error) {
    if (error instanceof AppError) {
      logRouteError('/api/admin/commissions', context.requestId, error, { status: error.status, code: error.code });
      return fail(error, origin);
    }
    logRouteError('/api/admin/commissions', context.requestId, error, { status: 500 });
    return internalError(origin);
  }
}

export async function PATCH(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  const context = buildRequestContext(req, { route: '/api/admin/commissions', method: 'PATCH' });
  try {
    const admin = await requireAdminUser(req);
    const rate = await enforceAdminRate(req, admin.email, 'patch', 20);
    if (!rate.allowed) {
      logSecurityEvent('route_rate_limited', { ...context, adminEmail: admin.email, retryAfterSeconds: rate.retryAfterSeconds });
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many admin commission updates'), origin);
    }
    const body = ensureObject(await req.json());
    const id = asNumber(body.id, 'id');
    const rawStatus = asString(body.commission_status, 'commission_status', 20).toLowerCase();
    const payoutNote = typeof body.payout_note === 'string' ? body.payout_note.trim().slice(0, 240) : null;
    if (!ALLOWED_STATUSES.has(rawStatus)) {
      return NextResponse.json({ error: 'commission_status inválido' }, { status: 400 });
    }

    const patch: Record<string, unknown> = {
      commission_status: rawStatus,
      payout_note: payoutNote,
      updated_at: new Date().toISOString(),
    };
    if (rawStatus === 'paid') {
      patch.paid_at = new Date().toISOString();
    } else if (body.clear_paid_at === true) {
      patch.paid_at = null;
    }

    await supabase.from('affiliate_commissions').update(patch).eq('id', id);
    invalidateCacheByPrefix('admin:');
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      logRouteError('/api/admin/commissions', context.requestId, error, { status: error.status, code: error.code });
      return fail(error, origin);
    }
    logRouteError('/api/admin/commissions', context.requestId, error, { status: 500 });
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
