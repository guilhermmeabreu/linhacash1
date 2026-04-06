import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { auditLog } from '@/lib/services/audit-log-service';
import { acquireIdempotencyKey } from '@/lib/services/idempotency-service';
import { activatePaidPro } from '@/lib/services/billing-service';
import { validateCheckoutPlan } from '@/lib/validators/billing-validator';
import { invalidateCacheByPrefix } from '@/lib/cache/memory-cache';
import { createCommissionForApprovedPayment } from '@/lib/services/affiliate-commission-service';
import { getIP, rateLimitDetailed } from '@/lib/rate-limit';
import { requireEnv } from '@/lib/env';
import { buildRequestContext, logRouteError, logSecurityEvent } from '@/lib/observability';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

function secureCompare(a: string, b: string) {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validateSignature(req: Request, paymentId: string): boolean {
  const signature = req.headers.get('x-signature') || '';
  const requestId = req.headers.get('x-request-id') || '';
  const tsRaw = signature.split(',').find((part) => part.startsWith('ts='))?.split('=')[1];
  const v1 = signature.split(',').find((part) => part.startsWith('v1='))?.split('=')[1];
  const ts = tsRaw ? Number.parseInt(tsRaw, 10) : Number.NaN;

  if (!Number.isFinite(ts) || !v1 || !requestId || !process.env.MP_WEBHOOK_SECRET) return false;
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (ageSeconds > 5 * 60) return false;

  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', process.env.MP_WEBHOOK_SECRET).update(manifest).digest('hex');
  return secureCompare(expected, v1);
}

function resolveAndValidateUserId(payment: any): string | null {
  const externalRef = typeof payment.external_reference === 'string' ? payment.external_reference : '';
  const metadataUserId = typeof payment.metadata?.user_id === 'string' ? payment.metadata.user_id : '';
  const fromExternalRef = externalRef.split(':')[0];

  if (fromExternalRef && metadataUserId && fromExternalRef !== metadataUserId) {
    return null;
  }

  const candidate = fromExternalRef || metadataUserId;
  return candidate && isValidUuid(candidate) ? candidate : null;
}

export async function POST(req: Request) {
  const ip = getIP(req);
  const context = buildRequestContext(req, { route: '/api/webhook/mp' });
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return Response.json({ error: 'Unsupported content type' }, { status: 415 });
  }
  const body = await req.json().catch(() => null);
  const paymentId = String(body?.data?.id || '');
  const requestId = req.headers.get('x-request-id') || 'no-request-id';

  try {
    logSecurityEvent('webhook_received', { ...context, requestId });
    if (!process.env.MP_WEBHOOK_SECRET) {
      await auditLog('webhook_event', { status: 'denied', reason: 'missing_webhook_secret' });
      logSecurityEvent('webhook_denied', { ...context, reason: 'missing_webhook_secret' });
      return Response.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    const byIp = await rateLimitDetailed(`webhook:mp:${ip}`, 120, 60_000);
    if (!byIp.allowed) {
      await auditLog('webhook_event', { status: 'denied', reason: 'rate_limited' });
      logSecurityEvent('webhook_denied', { ...context, reason: 'rate_limited_ip', retryAfterSeconds: byIp.retryAfterSeconds });
      return Response.json({ error: 'Rate limited' }, { status: 429 });
    }
    const byRequestId = await rateLimitDetailed(`webhook:mp:req:${requestId}`, 5, 60_000);
    if (!byRequestId.allowed) {
      await auditLog('webhook_event', { status: 'denied', reason: 'request_id_rate_limited', requestId });
      logSecurityEvent('webhook_denied', { ...context, reason: 'rate_limited_request_id', requestId, retryAfterSeconds: byRequestId.retryAfterSeconds });
      return Response.json({ error: 'Rate limited' }, { status: 429 });
    }

    if (!paymentId || !/^\d{4,32}$/.test(paymentId) || body?.type !== 'payment') {
      await auditLog('webhook_event', { status: 'ignored', reason: 'not_payment_event' });
      return Response.json({ ok: true });
    }

    if (!validateSignature(req, paymentId)) {
      await auditLog('webhook_event', { status: 'denied', reason: 'invalid_signature' });
      logSecurityEvent('webhook_denied', { ...context, reason: 'invalid_signature', paymentId });
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const lockAcquired = await acquireIdempotencyKey(`mp:webhook:${paymentId}`);
    if (!lockAcquired) {
      await auditLog('webhook_event', { status: 'ignored', reason: 'idempotent_replay', paymentId });
      logSecurityEvent('webhook_denied', { ...context, reason: 'idempotent_replay', paymentId });
      return Response.json({ ok: true });
    }

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${requireEnv('MP_ACCESS_TOKEN')}` },
      cache: 'no-store',
    });
    if (!response.ok) {
      await auditLog('webhook_event', { status: 'failed', reason: 'provider_lookup_failed', paymentId, statusCode: response.status });
      return Response.json({ ok: true });
    }

    const payment = await response.json();

    if (payment.status !== 'approved') {
      await auditLog('webhook_event', { status: 'ignored', reason: 'payment_not_approved', paymentId, paymentStatus: payment.status });
      return Response.json({ ok: true });
    }

    const userId = resolveAndValidateUserId(payment);
    if (!userId) {
      await auditLog('webhook_event', { status: 'failed', reason: 'missing_or_inconsistent_user_association', paymentId });
      return Response.json({ ok: true });
    }

    const referralCode = typeof payment.metadata?.referral_code === 'string' ? payment.metadata.referral_code.trim().toUpperCase() : null;
    const plan = validateCheckoutPlan(payment.metadata?.plan || 'mensal');
    const externalReference = typeof payment.external_reference === 'string' ? payment.external_reference : null;

    await activatePaidPro({
      userId,
      paymentId,
      externalReference,
      referralCode,
      plan,
      approvedAt: typeof payment.date_approved === 'string' ? payment.date_approved : undefined,
    });

    if (referralCode) {
      const grossAmount = typeof payment.transaction_amount === 'number' ? payment.transaction_amount : Number(payment.transaction_amount || 0);
      const commissionResult = await createCommissionForApprovedPayment({
        referralCode,
        userId,
        paymentId,
        plan,
        grossAmount,
        approvedAt: typeof payment.date_approved === 'string' ? payment.date_approved : undefined,
      });

      await auditLog('affiliate_commission_upserted', {
        paymentId,
        userId,
        referralCode,
        result: commissionResult.reason,
        commissionAmount: commissionResult.commissionAmount,
        commissionPct: commissionResult.commissionPct,
      });

      const { error: incrementError } = await supabase.rpc('increment_referral_use', { referral_code: referralCode });
      if (incrementError) {
        const { data: refData } = await supabase.from('referral_codes').select('uses').eq('code', referralCode).single();
        await supabase.from('referral_codes').update({ uses: (refData?.uses || 0) + 1 }).eq('code', referralCode);
      }
    }

    if (referralCode) {
      const { data: existingReferralUse } = await supabase.from('referral_uses').select('id').eq('payment_id', paymentId).maybeSingle();
      if (!existingReferralUse) {
        await supabase.from('referral_uses').insert({ code: referralCode, user_id: userId, payment_id: paymentId, created_at: new Date().toISOString() });
      }
    }
    invalidateCacheByPrefix('admin:');

    await auditLog('webhook_event', { status: 'processed', paymentId, userId, plan });
    logSecurityEvent('webhook_processed', { ...context, paymentId, userId, plan });
    return Response.json({ ok: true });
  } catch (error) {
    await auditLog('webhook_event', { status: 'failed', paymentId });
    logRouteError('/api/webhook/mp', context.requestId, error, { paymentId, requestId });
    logSecurityEvent('webhook_failed', { ...context, paymentId, requestId });
    return Response.json({ ok: true });
  }
}
