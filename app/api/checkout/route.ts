import { AppError, ExternalIntegrationError } from '@/lib/http/errors';
import { fail, internalError, ok, options } from '@/lib/http/responses';
import { getIP, rateLimit } from '@/lib/rate-limit';
import { requireAuthenticatedUser } from '@/lib/auth/authorization';
import { validateCheckoutPayload } from '@/lib/validators/auth-validator';
import { requireEnv } from '@/lib/env';
import { assertAllowedOrigin, readJsonObject } from '@/lib/http/request-guards';
import { auditLog } from '@/lib/services/audit-log-service';
import crypto from 'crypto';

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  const requestUrl = new URL(req.url);
  const publicBaseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
  try {
    assertAllowedOrigin(req);
    const ip = getIP(req);
    if (!(await rateLimit(`checkout:${ip}`, 5, 60_000))) {
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many checkout attempts'), origin);
    }

    const user = await requireAuthenticatedUser(req);
    const { plan, referralCode } = validateCheckoutPayload(await readJsonObject(req));
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
      metadata: { referral_code: referralCode, plan, user_id: user.id, external_reference: externalReference },
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

    await auditLog('plan_change', { userId: user.id, status: 'checkout_created', plan, referralCode: referralCode || null });
    return ok({ url: checkoutUrl });
  } catch (error) {
    if (error instanceof AppError) return fail(error, origin);
    console.error('[checkout] Unexpected checkout failure', error);
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
