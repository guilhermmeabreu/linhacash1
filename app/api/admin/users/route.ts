import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminUser } from '@/lib/auth/authorization';
import { AppError } from '@/lib/http/errors';
import { fail, internalError, options } from '@/lib/http/responses';
import { asEmail, asUUID, ensureObject } from '@/lib/validators/common';
import { auditLog } from '@/lib/services/audit-log-service';
import { BillingProfileRow, resolveBillingState } from '@/lib/services/billing-domain';
import { grantManualPro, revokeManualPro } from '@/lib/services/billing-service';
import { validateAdminBillingAction } from '@/lib/validators/billing-validator';
import { getCachedValue, invalidateCacheByPrefix } from '@/lib/cache/memory-cache';
import { getIP, rateLimitDetailed } from '@/lib/rate-limit';
import { buildRequestContext, logRouteError, logSecurityEvent } from '@/lib/observability';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
type UsersProfileRow = BillingProfileRow & { id: string; name: string | null; email: string | null; created_at: string; plan: string | null };

async function enforceAdminRate(req: Request, adminEmail: string, action: string, limit = 45) {
  const rate = await rateLimitDetailed(`admin:users:${action}:${adminEmail}:${getIP(req)}`, limit, 60_000);
  return rate;
}

export async function GET(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  const context = buildRequestContext(req, { route: '/api/admin/users', method: 'GET' });
  try {
    const admin = await requireAdminUser(req);
    const rate = await enforceAdminRate(req, admin.email, 'get');
    if (!rate.allowed) {
      logSecurityEvent('route_rate_limited', { ...context, adminEmail: admin.email, retryAfterSeconds: rate.retryAfterSeconds });
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many admin user list requests'), origin);
    }
    const data = await getCachedValue('admin:users', 30_000, async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*,plan_status,plan_source,billing_status,subscription_started_at,subscription_expires_at,cancelled_at,granted_by_admin,granted_reason,payment_provider,payment_reference,subscription_reference,external_reference')
        .order('created_at', { ascending: false });

      return ((profiles || []) as UsersProfileRow[]).map((profile) => {
        const billing = resolveBillingState(profile);
        return {
          ...profile,
          plan: billing.hasProAccess ? 'pro' : 'free',
          billing,
        };
      });
    });

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AppError) {
      logRouteError('/api/admin/users', context.requestId, error, { status: error.status, code: error.code });
      return fail(error, origin);
    }
    logRouteError('/api/admin/users', context.requestId, error, { status: 500 });
    return internalError(origin);
  }
}

export async function PATCH(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  const context = buildRequestContext(req, { route: '/api/admin/users', method: 'PATCH' });
  try {
    const admin = await requireAdminUser(req);
    const rate = await enforceAdminRate(req, admin.email, 'patch', 20);
    if (!rate.allowed) {
      logSecurityEvent('route_rate_limited', { ...context, adminEmail: admin.email, retryAfterSeconds: rate.retryAfterSeconds });
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many admin billing changes'), origin);
    }
    const payload = validateAdminBillingAction(await req.json());

    if (payload.action === 'grant_manual_pro') {
      await grantManualPro({ userId: payload.id, adminEmail: admin.email, reason: payload.reason });
    }

    if (payload.action === 'revoke_manual_pro') {
      await revokeManualPro({ userId: payload.id, adminEmail: admin.email, reason: payload.reason });
    }

    await auditLog('billing_status_changed', {
      targetUserId: payload.id,
      action: payload.action,
      reason: payload.reason,
      actor: admin.email,
    });
    invalidateCacheByPrefix('admin:');

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      logRouteError('/api/admin/users', context.requestId, error, { status: error.status, code: error.code });
      return fail(error, origin);
    }
    logRouteError('/api/admin/users', context.requestId, error, { status: 500 });
    return internalError(origin);
  }
}

export async function PUT(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  const context = buildRequestContext(req, { route: '/api/admin/users', method: 'PUT' });
  try {
    const admin = await requireAdminUser(req);
    const rate = await enforceAdminRate(req, admin.email, 'put', 12);
    if (!rate.allowed) {
      logSecurityEvent('route_rate_limited', { ...context, adminEmail: admin.email, retryAfterSeconds: rate.retryAfterSeconds });
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many admin password reset requests'), origin);
    }
    const body = ensureObject(await req.json());
    const email = asEmail(body.email);
    await supabase.auth.admin.generateLink({ type: 'recovery', email });
    await auditLog('password_reset', { email });
    invalidateCacheByPrefix('admin:');
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      logRouteError('/api/admin/users', context.requestId, error, { status: error.status, code: error.code });
      return fail(error, origin);
    }
    logRouteError('/api/admin/users', context.requestId, error, { status: 500 });
    return internalError(origin);
  }
}

export async function DELETE(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  const context = buildRequestContext(req, { route: '/api/admin/users', method: 'DELETE' });
  try {
    const admin = await requireAdminUser(req);
    const rate = await enforceAdminRate(req, admin.email, 'delete', 8);
    if (!rate.allowed) {
      logSecurityEvent('route_rate_limited', { ...context, adminEmail: admin.email, retryAfterSeconds: rate.retryAfterSeconds });
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many admin delete requests'), origin);
    }
    const body = ensureObject(await req.json());
    const id = asUUID(body.id, 'id');
    await supabase.from('profiles').delete().eq('id', id);
    await supabase.auth.admin.deleteUser(id);
    invalidateCacheByPrefix('admin:');
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      logRouteError('/api/admin/users', context.requestId, error, { status: error.status, code: error.code });
      return fail(error, origin);
    }
    logRouteError('/api/admin/users', context.requestId, error, { status: 500 });
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
