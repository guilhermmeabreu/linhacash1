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

async function enforceAdminRate(req: Request, adminEmail: string, action: string, limit = 35) {
  return rateLimitDetailed(`admin:referrals:${action}:${adminEmail}:${getIP(req)}`, limit, 60_000);
}

export async function GET(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  const context = buildRequestContext(req, { route: '/api/admin/referrals', method: 'GET' });
  try {
    const admin = await requireAdminUser(req);
    const rate = await enforceAdminRate(req, admin.email, 'get', 45);
    if (!rate.allowed) {
      logSecurityEvent('route_rate_limited', { ...context, adminEmail: admin.email, retryAfterSeconds: rate.retryAfterSeconds });
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many admin referral list requests'), origin);
    }
    const data = await getCachedValue('admin:referrals', 30_000, async () => {
      const { data: rows } = await supabase.from('referral_codes').select('*').order('uses', { ascending: false });
      return rows || [];
    });
    return NextResponse.json(data || []);
  } catch (error) {
    if (error instanceof AppError) {
      logRouteError('/api/admin/referrals', context.requestId, error, { status: error.status, code: error.code });
      return fail(error, origin);
    }
    logRouteError('/api/admin/referrals', context.requestId, error, { status: 500 });
    return internalError(origin);
  }
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  const context = buildRequestContext(req, { route: '/api/admin/referrals', method: 'POST' });
  try {
    const admin = await requireAdminUser(req);
    const rate = await enforceAdminRate(req, admin.email, 'post', 15);
    if (!rate.allowed) {
      logSecurityEvent('route_rate_limited', { ...context, adminEmail: admin.email, retryAfterSeconds: rate.retryAfterSeconds });
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many admin referral create requests'), origin);
    }
    const body = ensureObject(await req.json());
    const code = asString(body.code, 'code', 20).toUpperCase();
    const influencer_name = asString(body.influencer_name, 'influencer_name', 120);
    await supabase.from('referral_codes').insert({ code, influencer_name, uses: 0, commission_pct: 25, active: true });
    invalidateCacheByPrefix('admin:');
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      logRouteError('/api/admin/referrals', context.requestId, error, { status: error.status, code: error.code });
      return fail(error, origin);
    }
    logRouteError('/api/admin/referrals', context.requestId, error, { status: 500 });
    return internalError(origin);
  }
}

export async function PATCH(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  const context = buildRequestContext(req, { route: '/api/admin/referrals', method: 'PATCH' });
  try {
    const admin = await requireAdminUser(req);
    const rate = await enforceAdminRate(req, admin.email, 'patch', 20);
    if (!rate.allowed) {
      logSecurityEvent('route_rate_limited', { ...context, adminEmail: admin.email, retryAfterSeconds: rate.retryAfterSeconds });
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many admin referral update requests'), origin);
    }
    const body = ensureObject(await req.json());
    const id = asNumber(body.id, 'id');
    await supabase.from('referral_codes').update({ active: !!body.active }).eq('id', id);
    invalidateCacheByPrefix('admin:');
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      logRouteError('/api/admin/referrals', context.requestId, error, { status: error.status, code: error.code });
      return fail(error, origin);
    }
    logRouteError('/api/admin/referrals', context.requestId, error, { status: 500 });
    return internalError(origin);
  }
}

export async function DELETE(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  const context = buildRequestContext(req, { route: '/api/admin/referrals', method: 'DELETE' });
  try {
    const admin = await requireAdminUser(req);
    const rate = await enforceAdminRate(req, admin.email, 'delete', 10);
    if (!rate.allowed) {
      logSecurityEvent('route_rate_limited', { ...context, adminEmail: admin.email, retryAfterSeconds: rate.retryAfterSeconds });
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many admin referral delete requests'), origin);
    }
    const body = ensureObject(await req.json());
    const id = asNumber(body.id, 'id');
    await supabase.from('referral_codes').delete().eq('id', id);
    invalidateCacheByPrefix('admin:');
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      logRouteError('/api/admin/referrals', context.requestId, error, { status: error.status, code: error.code });
      return fail(error, origin);
    }
    logRouteError('/api/admin/referrals', context.requestId, error, { status: 500 });
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
