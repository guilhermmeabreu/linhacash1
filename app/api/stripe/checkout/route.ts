import { createClient } from '@supabase/supabase-js';
import { AppError, ExternalIntegrationError, ValidationError } from '@/lib/http/errors';
import { fail, internalError, ok, options } from '@/lib/http/responses';
import { requireAuthenticatedUser } from '@/lib/auth/authorization';
import { readJsonObject } from '@/lib/http/request-guards';
import { isDebugMode, requireEnv } from '@/lib/env';
import { getStripeServerClient } from '@/lib/stripe/server';

type StripePlan = 'monthly' | 'annual' | 'playoff';

const PLAN_TO_PRICE_ID: Record<StripePlan, string> = {
  monthly: requireEnv('STRIPE_PRICE_PRO_MONTHLY'),
  annual: requireEnv('STRIPE_PRICE_PRO_ANNUAL'),
  playoff: requireEnv('STRIPE_PRICE_PLAYOFF_PACK'),
};

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function parsePlan(value: unknown): StripePlan {
  if (typeof value !== 'string') {
    throw new ValidationError('plan is required');
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'monthly' || normalized === 'annual' || normalized === 'playoff') {
    return normalized;
  }

  throw new ValidationError('plan must be monthly, annual, or playoff');
}

async function resolveStripeCustomerId(userId: string, email: string, name: string) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id as string;
  }

  const stripe = getStripeServerClient();
  const customer = await stripe.createCustomer({
    email,
    name,
    metadata: { user_id: userId },
  });

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      stripe_customer_id: customer.id,
      billing_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateError) throw updateError;

  return customer.id;
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || undefined;

  try {
    const user = await requireAuthenticatedUser(req);
    const body = await readJsonObject(req);
    const plan = parsePlan(body.plan);

    const appUrl = requireEnv('NEXT_PUBLIC_APP_URL').replace(/\/$/, '');
    const stripeCustomerId = await resolveStripeCustomerId(user.id, user.email, user.name);

    const stripe = getStripeServerClient();
    const checkout = await stripe.createCheckoutSession({
      mode: plan === 'playoff' ? 'payment' : 'subscription',
      customer: stripeCustomerId,
      success_url: `${appUrl}/app?checkout=success&plan=${plan}`,
      cancel_url: `${appUrl}/app?checkout=cancelled&plan=${plan}`,
      line_items: [{ price: PLAN_TO_PRICE_ID[plan], quantity: 1 }],
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        plan,
      },
      ...(plan === 'monthly'
        ? { subscription_data: { trial_period_days: 2, metadata: { user_id: user.id, plan } } }
        : plan === 'annual'
          ? { subscription_data: { metadata: { user_id: user.id, plan } } }
          : {}),
    });

    if (!checkout.url) {
      throw new ExternalIntegrationError('Stripe checkout URL not available');
    }

    return ok({ url: checkout.url, plan });
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === 'EXTERNAL_INTEGRATION_ERROR') {
        console.error('[stripe-checkout] request failed', {
          code: error.code,
          message: error.message,
          ...(isDebugMode() ? { details: error.details } : {}),
        });
      }
      return fail(error, origin);
    }
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
