import { createClient } from '@supabase/supabase-js';
import { AppError, ValidationError } from '@/lib/http/errors';
import { fail, internalError, ok, options } from '@/lib/http/responses';
import { requireAuthenticatedUser } from '@/lib/auth/authorization';
import { requireEnv } from '@/lib/env';
import { getStripeServerClient } from '@/lib/stripe/server';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || undefined;

  try {
    const user = await requireAuthenticatedUser(req);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;

    if (!profile?.stripe_customer_id) {
      throw new ValidationError('Cliente Stripe não encontrado para esta conta.');
    }

    const appUrl = requireEnv('NEXT_PUBLIC_APP_URL').replace(/\/$/, '');
    const stripe = getStripeServerClient();
    const portal = await stripe.createBillingPortalSession({
      customer: profile.stripe_customer_id as string,
      return_url: `${appUrl}/app?view=profile`,
    });

    return ok({ url: portal.url });
  } catch (error) {
    if (error instanceof AppError) return fail(error, origin);
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
