import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/env';
import { buildRequestContext, logRouteError } from '@/lib/observability';
import { findExistingReferralCode } from '@/lib/services/referral-service';
import { upsertAffiliateCommission } from '@/lib/services/affiliate-commission-service';
import { invalidateCacheByPrefix } from '@/lib/cache/memory-cache';

export const runtime = 'nodejs';

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
};

type WebhookMetadata = {
  userId: string | null;
  plan: string | null;
};

type StripeAccessStatus = 'active' | 'trialing' | 'canceled';
type StripePlan = 'monthly' | 'annual' | 'playoff';
type TrialConsumptionProfile = {
  trial_used_at: string | null;
  email: string | null;
};

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function verifyStripeSignature(payload: string, signatureHeader: string, webhookSecret: string): boolean {
  const entries = signatureHeader.split(',').map((part) => part.trim());
  const timestamp = entries.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = entries.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) return false;

  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs)) return false;

  const toleranceMs = 5 * 60 * 1000;
  if (Math.abs(Date.now() - timestampMs) > toleranceMs) return false;

  const expected = createHmac('sha256', webhookSecret).update(`${timestamp}.${payload}`, 'utf8').digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  return signatures.some((signature) => {
    try {
      const signatureBuffer = Buffer.from(signature, 'hex');
      if (signatureBuffer.length !== expectedBuffer.length) return false;
      return timingSafeEqual(signatureBuffer, expectedBuffer);
    } catch {
      return false;
    }
  });
}

function readMetadata(source: Record<string, unknown> | null | undefined): WebhookMetadata {
  const metadata = (source?.metadata ?? null) as Record<string, unknown> | null;
  const userId = typeof metadata?.user_id === 'string' ? metadata.user_id : null;
  const plan = typeof metadata?.plan === 'string' ? metadata.plan : null;
  return { userId, plan };
}

function extractMetadataAndIds(eventObject: Record<string, unknown>): {
  metadata: WebhookMetadata;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  clientReferenceId: string | null;
  customerEmail: string | null;
} {
  const direct = readMetadata(eventObject);

  const subscriptionDetails = eventObject.subscription_details as Record<string, unknown> | undefined;
  const subscriptionMetadata = readMetadata(subscriptionDetails ?? null);

  const lines = eventObject.lines as { data?: Array<Record<string, unknown>> } | undefined;
  const lineMetadata = readMetadata(lines?.data?.[0] ?? null);

  const metadata: WebhookMetadata = {
    userId: direct.userId ?? subscriptionMetadata.userId ?? lineMetadata.userId,
    plan: direct.plan ?? subscriptionMetadata.plan ?? lineMetadata.plan,
  };

  const stripeCustomerId = typeof eventObject.customer === 'string' ? eventObject.customer : null;
  const stripeSubscriptionId = typeof eventObject.subscription === 'string' ? eventObject.subscription : null;
  const clientReferenceId = typeof eventObject.client_reference_id === 'string' ? eventObject.client_reference_id : null;
  const customerEmail = typeof eventObject.customer_email === 'string' ? eventObject.customer_email.trim().toLowerCase() : null;

  return { metadata, stripeCustomerId, stripeSubscriptionId, clientReferenceId, customerEmail };
}

async function resolveUserId(
  userId: string | null,
  stripeCustomerId: string | null,
  clientReferenceId: string | null,
  customerEmail: string | null,
): Promise<string | null> {
  if (userId) return userId;
  if (clientReferenceId) return clientReferenceId;
  if (!stripeCustomerId && !customerEmail) return null;

  if (stripeCustomerId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle();

    if (error) {
      console.error('[route-error]', JSON.stringify({
        route: '/api/stripe/webhook',
        status: 500,
        errorCode: 'SUPABASE_LOOKUP_FAILED',
        provider: 'supabase',
        lookup: 'stripe_customer_id',
        ts: new Date().toISOString(),
      }));
      return null;
    }

    const mappedByCustomer = (data?.id as string | undefined) ?? null;
    if (mappedByCustomer) return mappedByCustomer;
  }

  if (customerEmail) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', customerEmail)
      .maybeSingle();

    if (!error) {
      return (data?.id as string | undefined) ?? null;
    }
  }

  return null;
}

async function patchProfile(userId: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

function asStripePlan(value: string | null): StripePlan | null {
  if (value === 'monthly' || value === 'annual' || value === 'playoff') return value;
  return null;
}

function resolvePlanStatus(status: StripeAccessStatus): 'active' | 'cancelled' {
  return status === 'active' || status === 'trialing' ? 'active' : 'cancelled';
}

function buildStripeOwnershipPatch(input: {
  status: StripeAccessStatus;
  plan: StripePlan | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd?: boolean;
  isPro?: boolean;
  clearAccess?: boolean;
  paymentReference?: string | null;
  subscriptionExpiresAt?: string | null;
}): Record<string, unknown> {
  const planStatus = resolvePlanStatus(input.status);
  const isPlayoff = input.plan === 'playoff';
  const cancelAtPeriodEnd = Boolean(input.cancelAtPeriodEnd);
  const isPro = typeof input.isPro === 'boolean' ? input.isPro : input.status !== 'canceled';
  const shouldClearAccess = Boolean(input.clearAccess);

  const patch: Record<string, unknown> = {
    stripe_customer_id: input.stripeCustomerId,
    stripe_subscription_id: input.stripeSubscriptionId,
    subscription_status: input.status,
    plan: isPro ? 'pro' : 'free',
    plan_source: isPro ? 'stripe' : 'free',
    plan_status: isPro ? (cancelAtPeriodEnd ? 'cancelled' : planStatus) : 'none',
    billing_status: isPro ? (cancelAtPeriodEnd ? 'cancelled' : planStatus) : 'none',
    payment_provider: 'stripe',
    subscription_reference: input.stripeSubscriptionId,
    granted_by_admin: null,
    granted_reason: null,
    cancelled_at: cancelAtPeriodEnd || input.status === 'canceled' ? new Date().toISOString() : null,
    playoff_pack_active: isPro && isPlayoff,
    cancel_at_period_end: cancelAtPeriodEnd,
    is_pro: isPro,
    billing_updated_at: new Date().toISOString(),
  };

  if (typeof input.paymentReference !== 'undefined') {
    patch.payment_reference = input.paymentReference;
  }

  if (typeof input.subscriptionExpiresAt !== 'undefined') {
    patch.subscription_expires_at = input.subscriptionExpiresAt;
    patch.pro_expires_at = input.subscriptionExpiresAt;
  }

  if (shouldClearAccess) {
    patch.plan = 'free';
    patch.plan_source = 'free';
    patch.plan_status = 'none';
    patch.billing_status = 'none';
    patch.subscription_status = 'canceled';
    patch.subscription_expires_at = null;
    patch.pro_expires_at = null;
    patch.cancel_at_period_end = false;
    patch.is_pro = false;
    patch.playoff_pack_active = false;
  }

  return patch;
}

function mapStripePlanToLegacyReferralPlan(plan: string | null): 'mensal' | 'anual' | null {
  if (plan === 'monthly') return 'mensal';
  if (plan === 'annual') return 'anual';
  return null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function consumeMonthlyTrialIfConfirmed(input: {
  userId: string;
  plan: StripePlan | null;
  status: StripeAccessStatus;
  stripeCustomerId: string | null;
  customerEmail: string | null;
}) {
  if (input.plan !== 'monthly' || input.status !== 'trialing') return;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('trial_used_at,email')
    .eq('id', input.userId)
    .maybeSingle<TrialConsumptionProfile>();
  if (profileError) throw profileError;
  if (!profile) return;

  if (typeof profile.trial_used_at === 'string' && profile.trial_used_at.length > 0) return;

  const consumedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      trial_used_at: consumedAt,
      trial_eligible: false,
      billing_updated_at: consumedAt,
    })
    .eq('id', input.userId);
  if (updateError) throw updateError;

  const rawEmail = typeof profile.email === 'string' && profile.email.length > 0 ? profile.email : input.customerEmail;
  if (!rawEmail) return;

  const { error: trialUsageError } = await supabase
    .from('trial_usage')
    .insert({
      email: rawEmail,
      normalized_email: normalizeEmail(rawEmail),
      stripe_customer_id: input.stripeCustomerId,
      first_user_id: input.userId,
    });

  if (trialUsageError && trialUsageError.code !== '23505') {
    throw trialUsageError;
  }
}

async function getActiveProfileReferralCode(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('referral_code_used').eq('id', userId).maybeSingle();
  if (error) throw error;

  const stored = typeof data?.referral_code_used === 'string' ? data.referral_code_used.trim().toUpperCase() : null;
  if (!stored) return null;
  const referral = await findExistingReferralCode(stored);
  return referral?.active ? referral.code : null;
}

async function registerReferralAttribution(input: {
  userId: string;
  paymentId: string;
  plan: string | null;
  paidAt: string | null;
  transactionAmountBrl: number | null;
}) {
  const referralCode = await getActiveProfileReferralCode(input.userId);
  if (!referralCode) return;

  const { data: existingReferralUse, error: referralUseLookupError } = await supabase
    .from('referral_uses')
    .select('id')
    .eq('payment_id', input.paymentId)
    .maybeSingle();
  if (referralUseLookupError) throw referralUseLookupError;

  if (!existingReferralUse) {
    const { error: insertReferralUseError } = await supabase
      .from('referral_uses')
      .insert({
        code: referralCode,
        user_id: input.userId,
        payment_id: input.paymentId,
        created_at: input.paidAt || new Date().toISOString(),
      });
    if (insertReferralUseError) throw insertReferralUseError;

    const { error: incrementError } = await supabase.rpc('increment_referral_use', { referral_code: referralCode });
    if (incrementError) {
      const { data: refData, error: refLookupError } = await supabase
        .from('referral_codes')
        .select('uses')
        .eq('code', referralCode)
        .maybeSingle();
      if (refLookupError) throw refLookupError;
      const currentUses = Number(refData?.uses || 0);
      const { error: fallbackIncrementError } = await supabase
        .from('referral_codes')
        .update({ uses: currentUses + 1 })
        .eq('code', referralCode);
      if (fallbackIncrementError) throw fallbackIncrementError;
    }
  }

  const commissionPlan = mapStripePlanToLegacyReferralPlan(input.plan);
  if (!commissionPlan) return;

  await upsertAffiliateCommission({
    code: referralCode,
    userId: input.userId,
    paymentId: input.paymentId,
    plan: commissionPlan,
    transactionAmount: input.transactionAmountBrl,
    paidAt: input.paidAt,
  });
}

async function handleCheckoutSessionCompleted(eventObject: Record<string, unknown>) {
  const {
    metadata,
    stripeCustomerId,
    stripeSubscriptionId,
    clientReferenceId,
    customerEmail,
  } = extractMetadataAndIds(eventObject);
  const userId = await resolveUserId(metadata.userId, stripeCustomerId, clientReferenceId, customerEmail);

  if (!userId) {
    console.error('[route-error]', JSON.stringify({
      route: '/api/stripe/webhook',
      status: 422,
      errorCode: 'USER_ID_MISSING',
      provider: 'stripe',
      eventType: 'checkout.session.completed',
      ts: new Date().toISOString(),
    }));
    return;
  }

  const stripeMode = typeof eventObject.mode === 'string' ? eventObject.mode : null;
  const paymentStatus = typeof eventObject.payment_status === 'string' ? eventObject.payment_status : null;
  const status: StripeAccessStatus = stripeMode === 'subscription'
    ? paymentStatus === 'no_payment_required'
      ? 'trialing'
      : 'active'
    : paymentStatus === 'paid'
      ? 'active'
      : 'canceled';
  const stripePlan = asStripePlan(metadata.plan);
  const paidAt = typeof eventObject.created === 'number' ? new Date(eventObject.created * 1000).toISOString() : new Date().toISOString();
  const amountTotal = typeof eventObject.amount_total === 'number' ? Number(eventObject.amount_total) / 100 : null;
  const checkoutPaymentReference = typeof eventObject.payment_intent === 'string'
    ? eventObject.payment_intent
    : typeof eventObject.id === 'string'
      ? `stripe_session:${eventObject.id}`
      : null;

  await patchProfile(userId, buildStripeOwnershipPatch({
    status,
    plan: stripePlan,
    stripeCustomerId,
    stripeSubscriptionId,
    cancelAtPeriodEnd: false,
    isPro: status !== 'canceled',
    paymentReference: checkoutPaymentReference,
  }));

  if (stripeMode === 'payment' && paymentStatus === 'paid') {
    const paymentIntentId = typeof eventObject.payment_intent === 'string' ? eventObject.payment_intent : null;
    const paymentId = paymentIntentId || `stripe_session:${typeof eventObject.id === 'string' ? eventObject.id : userId}`;
    await registerReferralAttribution({
      userId,
      paymentId,
      plan: metadata.plan,
      paidAt,
      transactionAmountBrl: amountTotal,
    });
  }
}

async function handleInvoicePaid(eventObject: Record<string, unknown>) {
  const {
    metadata,
    stripeCustomerId,
    stripeSubscriptionId,
    clientReferenceId,
    customerEmail,
  } = extractMetadataAndIds(eventObject);
  const userId = await resolveUserId(metadata.userId, stripeCustomerId, clientReferenceId, customerEmail);

  if (!userId) {
    console.error('[route-error]', JSON.stringify({
      route: '/api/stripe/webhook',
      status: 422,
      errorCode: 'USER_ID_MISSING',
      provider: 'stripe',
      eventType: 'invoice.payment_succeeded',
      ts: new Date().toISOString(),
    }));
    return;
  }

  const stripePlan = asStripePlan(metadata.plan);
  const periodEnd = typeof eventObject.period_end === 'number'
    ? new Date(eventObject.period_end * 1000).toISOString()
    : undefined;
  const invoiceId = typeof eventObject.id === 'string' ? eventObject.id : null;
  const paymentReference = typeof eventObject.payment_intent === 'string'
    ? eventObject.payment_intent
    : invoiceId
      ? `stripe_invoice:${invoiceId}`
      : null;

  await patchProfile(userId, buildStripeOwnershipPatch({
    status: 'active',
    plan: stripePlan,
    stripeCustomerId,
    stripeSubscriptionId,
    isPro: true,
    cancelAtPeriodEnd: false,
    paymentReference,
    subscriptionExpiresAt: periodEnd,
  }));

  const subscriptionReference = stripeSubscriptionId || (typeof eventObject.subscription === 'string' ? eventObject.subscription : null);
  const paymentId = subscriptionReference ? `stripe_sub:${subscriptionReference}` : invoiceId ? `stripe_invoice:${invoiceId}` : null;
  if (!paymentId) return;

  const paidAt = typeof eventObject.status_transitions === 'object' && eventObject.status_transitions
    ? (() => {
      const transitions = eventObject.status_transitions as Record<string, unknown>;
      const paidAtUnix = typeof transitions.paid_at === 'number' ? transitions.paid_at : null;
      return paidAtUnix ? new Date(paidAtUnix * 1000).toISOString() : new Date().toISOString();
    })()
    : new Date().toISOString();
  const amountPaid = typeof eventObject.amount_paid === 'number' ? Number(eventObject.amount_paid) / 100 : null;
  await registerReferralAttribution({
    userId,
    paymentId,
    plan: metadata.plan,
    paidAt,
    transactionAmountBrl: amountPaid,
  });
}

async function handleInvoicePaymentFailed(eventObject: Record<string, unknown>) {
  const {
    metadata,
    stripeCustomerId,
    stripeSubscriptionId,
    clientReferenceId,
    customerEmail,
  } = extractMetadataAndIds(eventObject);
  const userId = await resolveUserId(metadata.userId, stripeCustomerId, clientReferenceId, customerEmail);

  if (!userId) {
    console.error('[route-error]', JSON.stringify({
      route: '/api/stripe/webhook',
      status: 422,
      errorCode: 'USER_ID_MISSING',
      provider: 'stripe',
      eventType: 'invoice.payment_failed',
      ts: new Date().toISOString(),
    }));
    return;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('pro_expires_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;

  const expiresAt = typeof profile?.pro_expires_at === 'string' ? profile.pro_expires_at : null;
  const stillActive = expiresAt ? new Date(expiresAt).getTime() > Date.now() : false;
  const stripePlan = asStripePlan(metadata.plan);

  await patchProfile(userId, buildStripeOwnershipPatch({
    status: stillActive ? 'active' : 'canceled',
    plan: stripePlan,
    stripeCustomerId,
    stripeSubscriptionId,
    isPro: stillActive,
    cancelAtPeriodEnd: true,
    subscriptionExpiresAt: expiresAt,
  }));
}

async function handleSubscriptionDeleted(eventObject: Record<string, unknown>) {
  const {
    metadata,
    stripeCustomerId,
    stripeSubscriptionId,
    clientReferenceId,
    customerEmail,
  } = extractMetadataAndIds(eventObject);
  const userId = await resolveUserId(metadata.userId, stripeCustomerId, clientReferenceId, customerEmail);

  if (!userId) {
    console.error('[route-error]', JSON.stringify({
      route: '/api/stripe/webhook',
      status: 422,
      errorCode: 'USER_ID_MISSING',
      provider: 'stripe',
      eventType: 'customer.subscription.deleted',
      ts: new Date().toISOString(),
    }));
    return;
  }

  await patchProfile(userId, buildStripeOwnershipPatch({
    status: 'canceled',
    plan: null,
    stripeCustomerId,
    stripeSubscriptionId,
    isPro: false,
    clearAccess: true,
  }));
}

async function handleSubscriptionUpsert(eventObject: Record<string, unknown>) {
  const {
    metadata,
    stripeCustomerId,
    stripeSubscriptionId,
    clientReferenceId,
    customerEmail,
  } = extractMetadataAndIds(eventObject);
  const userId = await resolveUserId(metadata.userId, stripeCustomerId, clientReferenceId, customerEmail);

  if (!userId) {
    console.error('[route-error]', JSON.stringify({
      route: '/api/stripe/webhook',
      status: 422,
      errorCode: 'USER_ID_MISSING',
      provider: 'stripe',
      eventType: 'customer.subscription.updated',
      ts: new Date().toISOString(),
    }));
    return;
  }

  const subscriptionStatusRaw = typeof eventObject.status === 'string' ? eventObject.status.trim().toLowerCase() : '';
  const cancelAtPeriodEnd = Boolean(eventObject.cancel_at_period_end);
  const subscriptionStatus: StripeAccessStatus = subscriptionStatusRaw === 'trialing'
    ? 'trialing'
    : subscriptionStatusRaw === 'active'
      ? 'active'
      : 'canceled';

  const stripePlan = asStripePlan(metadata.plan);
  const periodEnd = typeof eventObject.current_period_end === 'number'
    ? new Date(eventObject.current_period_end * 1000).toISOString()
    : undefined;

  await patchProfile(userId, buildStripeOwnershipPatch({
    status: subscriptionStatus === 'canceled' && cancelAtPeriodEnd ? 'active' : subscriptionStatus,
    plan: stripePlan,
    stripeCustomerId,
    stripeSubscriptionId: typeof eventObject.id === 'string' ? eventObject.id : stripeSubscriptionId,
    cancelAtPeriodEnd,
    isPro: cancelAtPeriodEnd ? true : subscriptionStatus !== 'canceled',
    subscriptionExpiresAt: periodEnd,
  }));

  await consumeMonthlyTrialIfConfirmed({
    userId,
    plan: stripePlan,
    status: subscriptionStatus,
    stripeCustomerId,
    customerEmail,
  });
}

export async function GET() {
  return Response.json({ message: 'Webhook alive' }, { status: 200 });
}

export async function POST(req: Request) {
  const context = buildRequestContext(req, { route: '/api/stripe/webhook' });
  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      logRouteError('/api/stripe/webhook', context.requestId, new Error('Missing Stripe signature'), {
        status: 400,
        errorCode: 'STRIPE_SIGNATURE_MISSING',
        provider: 'stripe',
      });
      return Response.json({ error: 'Missing signature' }, { status: 400 });
    }

    const payload = await req.text();
    const webhookSecret = requireEnv('STRIPE_WEBHOOK_SECRET');

    if (!verifyStripeSignature(payload, signature, webhookSecret)) {
      logRouteError('/api/stripe/webhook', context.requestId, new Error('Invalid Stripe signature'), {
        status: 400,
        errorCode: 'STRIPE_SIGNATURE_INVALID',
        provider: 'stripe',
      });
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(payload) as StripeEvent;

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(event.data.object);
          break;
        case 'invoice.paid':
        case 'invoice.payment_succeeded':
          await handleInvoicePaid(event.data.object);
          break;
        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object);
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await handleSubscriptionUpsert(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object);
          break;
        default:
          break;
      }
      invalidateCacheByPrefix('admin:');
    } catch (handlerError) {
      logRouteError('/api/stripe/webhook', context.requestId, handlerError, {
        status: 500,
        eventId: event.id,
        eventType: event.type,
        provider: 'stripe',
      });
    }

    return Response.json({ received: true }, { status: 200 });
  } catch (error) {
    logRouteError('/api/stripe/webhook', context.requestId, error, {
      status: 500,
      provider: 'stripe',
    });
    return Response.json({ received: true }, { status: 200 });
  }
}
