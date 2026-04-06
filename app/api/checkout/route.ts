import { AppError, ExternalIntegrationError } from '@/lib/http/errors';
import { fail, internalError, ok, options } from '@/lib/http/responses';
import { getIP, rateLimitDetailed } from '@/lib/rate-limit';
import { requireAuthenticatedUser } from '@/lib/auth/authorization';
import { validateCheckoutPayload } from '@/lib/validators/auth-validator';
import { requireEnv } from '@/lib/env';
import { assertAllowedOrigin, readJsonObject } from '@/lib/http/request-guards';
import { auditLog } from '@/lib/services/audit-log-service';
import { buildRequestContext, logRouteError, logSecurityEvent } from '@/lib/observability';
import { findExistingReferralCode, requireActiveReferralCode } from '@/lib/services/referral-service';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  const requestUrl = new URL(req.url);
  const publicBaseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
  const context = buildRequestContext(req);
  try {
    assertAllowedOrigin(req);
    const ip = getIP(req);
    const rate = await rateLimitDetailed(`checkout:${ip}`, 5, 60_000);
    if (!rate.allowed) {
      logSecurityEvent('route_rate_limited', { ...context, route: '/api/checkout', retryAfterSeconds: rate.retryAfterSeconds });
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many checkout attempts'), origin);
    }

    const user = await requireAuthenticatedUser(req);
    logSecurityEvent('checkout_attempt', { ...context, userId: user.id });
    const { plan, referralCode } = validateCheckoutPayload(await readJsonObject(req));
    let resolvedReferralCode: string | null = null;

    if (referralCode) {
      const referral = await requireActiveReferralCode(referralCode);
      resolvedReferralCode = referral.code;
      await supabase.from('profiles').update({ referral_code_used: referral.code }).eq('id', user.id);
    } else {
      const { data: profile } = await supabase.from('profiles').select('referral_code_used').eq('id', user.id).maybeSingle();
      if (typeof profile?.referral_code_used === 'string' && profile.referral_code_used.trim()) {
        const referral = await findExistingReferralCode(profile.referral_code_used);
        if (referral?.active) {
          resolvedReferralCode = referral.code;
        }
      }
    }

    const mpAccessToken = requireEnv('MP_ACCESS_TOKEN');
    const price = Number((plan === 'anual' ? 197.0 : 24.9).toFixed(2));
    const title = plan === 'anual' ? 'LinhaCash Pro Anual' : 'LinhaCash Pro Mensal';
    const useSandboxCheckout = process.env.MP_USE_SANDBOX_CHECKOUT === 'true';

    const externalReference = `${user.id}:${Date.now()}:${plan}:${crypto.randomBytes(6).toString('hex')}`;

    const body: Record<string, unknown> = {
      items: [{ title, quantity: 1, currency_id: 'BRL', unit_price: price }],
      back_urls: {
        success: `${publicBaseUrl}/app.html?status=success`,
        failure: `${publicBaseUrl}/app.html?status=failure`,
        pending: `${publicBaseUrl}/app.html?status=pending`,
      },
      auto_return: 'approved',
      notification_url: `${publicBaseUrl}/api/webhook/mp`,
      metadata: { referral_code: resolvedReferralCode, plan, user_id: user.id, external_reference: externalReference },
      external_reference: externalReference,
      payer: { email: user.email },
    };

    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    const checkoutUrl = useSandboxCheckout ? data?.sandbox_init_point || data?.init_point : data?.init_point || data?.sandbox_init_point;
    if (!res.ok || !checkoutUrl) {
      console.error('[checkout] Mercado Pago preference creation failed', {
        status: res.status,
        statusText: res.statusText,
        userId: user.id,
        plan,
        error: data?.message || data,
      });
      throw new ExternalIntegrationError('Não foi possível iniciar o checkout no momento.');
    }

    logSecurityEvent('checkout_created', { ...context, userId: user.id, plan });
    await auditLog('plan_change', { userId: user.id, status: 'checkout_created', plan, referralCode: resolvedReferralCode });
    return ok({ url: checkoutUrl });
  } catch (error) {
    if (error instanceof AppError) return fail(error, origin);
    logRouteError('/api/checkout', context.requestId, error);
    logSecurityEvent('checkout_failed', context);
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
