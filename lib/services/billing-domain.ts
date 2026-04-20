export const PLAN = {
  FREE: 'free',
  PRO: 'pro',
} as const;

export const PLAN_SOURCE = {
  FREE: 'free',
  PAID: 'paid',
  STRIPE: 'stripe',
  ADMIN: 'admin',
} as const;

export const PLAN_STATUS = {
  NONE: 'none',
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;

export const BILLING_STATUS = {
  NONE: 'none',
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  MANUAL: 'manual',
  EXPIRED: 'expired',
} as const;

export type BillingPlan = (typeof PLAN)[keyof typeof PLAN];
export type BillingPlanSource = (typeof PLAN_SOURCE)[keyof typeof PLAN_SOURCE];
export type BillingPlanStatus = (typeof PLAN_STATUS)[keyof typeof PLAN_STATUS];
export type BillingStatus = (typeof BILLING_STATUS)[keyof typeof BILLING_STATUS];

export type BillingProfileRow = {
  id: string;
  plan: string | null;
  subscription_status?: string | null;
  playoff_pack_active?: boolean | null;
  billing_updated_at?: string | null;
  plan_status: string | null;
  plan_source: string | null;
  billing_status: string | null;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  cancelled_at: string | null;
  granted_by_admin: string | null;
  granted_reason: string | null;
  payment_provider: string | null;
  payment_reference: string | null;
  subscription_reference: string | null;
  external_reference: string | null;
  referral_code_used: string | null;
};

export type BillingState = {
  plan: BillingPlan;
  subscriptionStatus: string | null;
  playoffPackActive: boolean;
  billingUpdatedAt: string | null;
  planStatus: BillingPlanStatus;
  planSource: BillingPlanSource;
  billingStatus: BillingStatus;
  subscriptionStartedAt: string | null;
  subscriptionExpiresAt: string | null;
  cancelledAt: string | null;
  grantedByAdmin: string | null;
  grantedReason: string | null;
  paymentProvider: string | null;
  paymentReference: string | null;
  subscriptionReference: string | null;
  externalReference: string | null;
  referralCodeUsed: string | null;
  paidPlanType: 'monthly' | 'annual' | 'playoff' | 'legacy_paid' | null;
  hasProAccess: boolean;
  isPaidPro: boolean;
  isManualPro: boolean;
};

function normalizePlan(value: string | null): BillingPlan {
  return value === PLAN.PRO ? PLAN.PRO : PLAN.FREE;
}

function normalizePlanSource(value: string | null): BillingPlanSource {
  if (value === PLAN_SOURCE.PAID || value === PLAN_SOURCE.STRIPE || value === PLAN_SOURCE.ADMIN) return value;
  return PLAN_SOURCE.FREE;
}

function normalizePlanStatus(value: string | null): BillingPlanStatus {
  if (value === PLAN_STATUS.ACTIVE || value === PLAN_STATUS.CANCELLED || value === PLAN_STATUS.EXPIRED) return value;
  return PLAN_STATUS.NONE;
}

function normalizeBillingStatus(value: string | null): BillingStatus {
  if (value === BILLING_STATUS.ACTIVE || value === BILLING_STATUS.CANCELLED || value === BILLING_STATUS.MANUAL || value === BILLING_STATUS.EXPIRED) return value;
  return BILLING_STATUS.NONE;
}

export function resolveBillingState(row: BillingProfileRow): BillingState {
  const legacyPlan = normalizePlan(row.plan);
  const normalizedPlan = (row.plan || '').trim().toLowerCase();
  const subscriptionStatus = typeof row.subscription_status === 'string'
    ? row.subscription_status.trim().toLowerCase()
    : null;
  const isStripePlan = normalizedPlan === 'monthly' || normalizedPlan === 'annual' || normalizedPlan === 'playoff';
  const hasStripeSubscriptionAccess =
    (normalizedPlan === 'monthly' || normalizedPlan === 'annual') &&
    (subscriptionStatus === 'trialing' || subscriptionStatus === 'active');
  const hasStripePlayoffAccess = normalizedPlan === 'playoff' && Boolean(row.playoff_pack_active);
  const hasStripeProAccess = hasStripeSubscriptionAccess || hasStripePlayoffAccess;
  const stripeCancelled = isStripePlan && subscriptionStatus === 'canceled';
  const inferredPlanSource = isStripePlan ? PLAN_SOURCE.STRIPE : null;
  const inferredPlanStatus = isStripePlan
    ? hasStripeProAccess
      ? PLAN_STATUS.ACTIVE
      : stripeCancelled
        ? PLAN_STATUS.CANCELLED
        : PLAN_STATUS.EXPIRED
    : null;
  const inferredBillingStatus = isStripePlan
    ? hasStripeProAccess
      ? BILLING_STATUS.ACTIVE
      : stripeCancelled
        ? BILLING_STATUS.CANCELLED
        : BILLING_STATUS.EXPIRED
    : null;
  const planSource = inferredPlanSource || normalizePlanSource(row.plan_source);
  const planStatus = inferredPlanStatus || normalizePlanStatus(row.plan_status);
  const billingStatus = inferredBillingStatus || normalizeBillingStatus(row.billing_status);
  const hasPaidAccessSignal =
    (planSource === PLAN_SOURCE.STRIPE || planSource === PLAN_SOURCE.PAID) &&
    (subscriptionStatus === 'trialing' || subscriptionStatus === 'active' || planStatus === PLAN_STATUS.ACTIVE);
  const plan = legacyPlan === PLAN.PRO || hasStripeProAccess || hasPaidAccessSignal ? PLAN.PRO : PLAN.FREE;
  const now = Date.now();
  const expiresAt = row.subscription_expires_at ? new Date(row.subscription_expires_at).getTime() : null;
  const paidStillActive =
    (planSource === PLAN_SOURCE.STRIPE || planSource === PLAN_SOURCE.PAID) &&
    (planStatus === PLAN_STATUS.ACTIVE || (planStatus === PLAN_STATUS.CANCELLED && (!expiresAt || expiresAt > now)));

  const manualActive =
    plan === PLAN.PRO &&
    planSource === PLAN_SOURCE.ADMIN &&
    (planStatus === PLAN_STATUS.ACTIVE || planStatus === PLAN_STATUS.CANCELLED);
  const paidPlanType = hasStripeSubscriptionAccess
    ? normalizedPlan as 'monthly' | 'annual'
    : hasStripePlayoffAccess
      ? 'playoff'
      : paidStillActive
        ? 'legacy_paid'
        : null;

  return {
    plan,
    subscriptionStatus,
    playoffPackActive: Boolean(row.playoff_pack_active),
    billingUpdatedAt: row.billing_updated_at ?? null,
    planStatus,
    planSource,
    billingStatus,
    subscriptionStartedAt: row.subscription_started_at,
    subscriptionExpiresAt: row.subscription_expires_at,
    cancelledAt: row.cancelled_at,
    grantedByAdmin: row.granted_by_admin,
    grantedReason: row.granted_reason,
    paymentProvider: row.payment_provider,
    paymentReference: row.payment_reference,
    subscriptionReference: row.subscription_reference,
    externalReference: row.external_reference,
    referralCodeUsed: row.referral_code_used,
    paidPlanType,
    hasProAccess: hasStripeProAccess || paidStillActive || manualActive,
    isPaidPro: hasStripeProAccess || paidStillActive,
    isManualPro: manualActive,
  };
}
