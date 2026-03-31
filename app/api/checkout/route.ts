import { AppError, ExternalIntegrationError } from '@/lib/http/errors';
import { fail, internalError, ok, options } from '@/lib/http/responses';
import { getIP, rateLimit } from '@/lib/rate-limit';
import { requireAuthenticatedUser } from '@/lib/auth/authorization';
import { validateCheckoutPayload } from '@/lib/validators/auth-validator';

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  try {
    const ip = getIP(req);
    if (!(await rateLimit(`checkout:${ip}`, 5, 60_000))) {
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many checkout attempts'), origin);
    }

    const user = await requireAuthenticatedUser(req);
    const { plan, referralCode } = validateCheckoutPayload(await req.json());
    const price = plan === 'anual' ? 197.0 : 24.9;
    const title = plan === 'anual' ? 'LinhaCash Pro Anual' : 'LinhaCash Pro Mensal';

    const body: Record<string, unknown> = {
      items: [{ title, quantity: 1, currency_id: 'BRL', unit_price: price }],
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_URL}/app.html?status=success`,
        failure: `${process.env.NEXT_PUBLIC_URL}/app.html?status=failure`,
        pending: `${process.env.NEXT_PUBLIC_URL}/app.html?status=pending`,
      },
      auto_return: 'approved',
      notification_url: `${process.env.NEXT_PUBLIC_URL}/api/webhook/mp`,
      metadata: { referral_code: referralCode, plan, user_id: user.id },
      external_reference: user.id,
      payer: { email: user.email },
    };

    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.init_point) throw new ExternalIntegrationError('Mercado Pago checkout creation failed');

    return ok({ url: data.init_point });
  } catch (error) {
    if (error instanceof AppError) return fail(error, origin);
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
