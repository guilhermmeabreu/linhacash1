import { createClient } from '@supabase/supabase-js';
import { AppError, ExternalIntegrationError, ValidationError } from '@/lib/http/errors';
import { fail, internalError, ok, options } from '@/lib/http/responses';
import { requireAuthenticatedUser } from '@/lib/auth/authorization';
import { readJsonObject } from '@/lib/http/request-guards';
import { requireEnv } from '@/lib/env';
import { getStripeServerClient } from '@/lib/stripe/server';
import { getIP, rateLimitDetailed } from '@/lib/rate-limit';
import { buildRequestContext, logRouteError, logSecurityEvent } from '@/lib/observability';
import { requireActiveReferralCode } from '@/lib/services/referral-service';

type StripePlan = 'monthly' | 'annual' | 'playoff';

type PlanPriceConfig = { envVar: 'STRIPE_PRICE_PRO_MONTHLY' | 'STRIPE_PRICE_PRO_ANNUAL' | 'STRIPE_PRICE_PLAYOFF_PACK'; priceId: string };

function getPlanPriceConfig(plan: StripePlan): PlanPriceConfig {
  if (plan === 'monthly') {
    return { envVar: 'STRIPE_PRICE_PRO_MONTHLY', priceId: requireEnv('STRIPE_PRICE_PRO_MONTHLY') };
  }
  if (plan === 'annual') {
    return { envVar: 'STRIPE_PRICE_PRO_ANNUAL', priceId: requireEnv('STRIPE_PRICE_PRO_ANNUAL') };
  }
  return { envVar: 'STRIPE_PRICE_PLAYOFF_PACK', priceId: requireEnv('STRIPE_PRICE_PLAYOFF_PACK') };
}

function inferStripeKeyMode(secretKey: string) {
  if (secretKey.startsWith('sk_live_')) return 'live';
  if (secretKey.startsWith('sk_test_')) return 'test';
  return 'unknown';
}

function extractStripeErrorMetadata(error: unknown): Record<string, unknown> {
  if (!(error instanceof AppError) || error.code !== 'EXTERNAL_INTEGRATION_ERROR') {
    return {};
  }

  const details = (error.details ?? {}) as Record<string, unknown>;
  const stripeError = (details.error ?? {}) as Record<string, unknown>;
  return {
    stripeStatus: typeof details.status === 'number' ? details.status : undefined,
    stripeStatusText: typeof details.statusText === 'string' ? details.statusText : undefined,
    stripeMessage: typeof stripeError.message === 'string' ? stripeError.message : undefined,
    stripeType: typeof stripeError.type === 'string' ? stripeError.type : undefined,
    stripeCode: typeof stripeError.code === 'string' ? stripeError.code : undefined,
    stripeParam: typeof stripeError.param === 'string' ? stripeError.param : undefined,
    stripeRequestId: typeof stripeError.request_id === 'string' ? stripeError.request_id : undefined,
  };
}

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
  const context = buildRequestContext(req, { route: '/api/stripe/checkout' });
  let userId: string | null = null;
  let plan: StripePlan | null = null;
  let selectedPrice: PlanPriceConfig | null = null;
  let resolvedReferralCode: string | null = null;

  try {
    const user = await requireAuthenticatedUser(req);
    userId = user.id;
    const ip = getIP(req);
    const actorKey = user.id ? `user:${user.id}` : `ip:${ip}`;
    const rate = await rateLimitDetailed(`stripe:checkout:${actorKey}`, 8, 60_000);
    if (!rate.allowed) {
      logSecurityEvent('route_rate_limited', { ...context, userId: user.id, retryAfterSeconds: rate.retryAfterSeconds });
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many stripe checkout attempts'), origin);
    }
    const body = await readJsonObject(req);
    plan = parsePlan(body.plan);
    selectedPrice = getPlanPriceConfig(plan);
    const requestedReferralCode = typeof body.referralCode === 'string' ? body.referralCode.trim() : '';
    if (requestedReferralCode) {
      const referral = await requireActiveReferralCode(requestedReferralCode);
      resolvedReferralCode = referral.code;
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ referral_code_used: referral.code })
        .eq('id', user.id);
      if (profileUpdateError) {
        throw profileUpdateError;
      }
    }

    const appUrl = requireEnv('NEXT_PUBLIC_APP_URL').replace(/\/$/, '');
    const stripeCustomerId = await resolveStripeCustomerId(user.id, user.email, user.name);
    const stripe = getStripeServerClient();
    const checkout = await stripe.createCheckoutSession({
      mode: plan === 'playoff' ? 'payment' : 'subscription',
      customer: stripeCustomerId,
      success_url: `${appUrl}/app?checkout=success&plan=${plan}`,
      cancel_url: `${appUrl}/app?checkout=cancelled&plan=${plan}`,
      line_items: [{ price: selectedPrice.priceId, quantity: 1 }],
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        plan,
        ...(resolvedReferralCode ? { referral_code: resolvedReferralCode } : {}),
      },
      ...(plan === 'monthly'
        ? {
          subscription_data: {
            trial_period_days: 7,
            metadata: { user_id: user.id, plan },
          },
        }
        : plan === 'annual'
          ? { subscription_data: { metadata: { user_id: user.id, plan } } }
          : {}),
    });

    if (!checkout.url) {
      throw new ExternalIntegrationError('Stripe checkout URL not available');
    }

    console.log('[stripe-checkout] session created', { userId: user.id, plan, checkoutSessionId: checkout.id });
    logSecurityEvent('checkout_created', { ...context, userId: user.id, plan, provider: 'stripe' });
    return ok({ url: checkout.url, plan });
  } catch (error) {
    const stripeDiagnostics = {
      ...extractStripeErrorMetadata(error),
      stripeKeyMode: inferStripeKeyMode(process.env.STRIPE_SECRET_KEY || ''),
      stripePriceEnvVar: selectedPrice?.envVar,
      stripePriceId: selectedPrice?.priceId,
      plan,
    };

    if (error instanceof AppError) {
      logRouteError('/api/stripe/checkout', context.requestId, error, {
        status: error.status,
        errorCode: error.code,
        provider: 'stripe',
        userId,
        ...stripeDiagnostics,
      });
      return fail(error, origin);
    }
    logRouteError('/api/stripe/checkout', context.requestId, error, {
      status: 500,
      provider: 'stripe',
      userId,
      ...stripeDiagnostics,
    });
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
