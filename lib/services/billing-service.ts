import {
  BILLING_STATUS,
  BillingState,
  PLAN,
  PLAN_SOURCE,
  PLAN_STATUS,
  resolveBillingState,
} from '@/lib/services/billing-domain';
import { getBillingProfileByUserId, updateBillingProfile } from '@/lib/repositories/billing-repository';
import { auditLog } from '@/lib/services/audit-log-service';

const PLAN_DURATION_DAYS = {
  mensal: 30,
  anual: 365,
} as const;

export async function getBillingState(userId: string): Promise<BillingState> {
  const row = await getBillingProfileByUserId(userId);
  if (!row) {
    return resolveBillingState({
      id: userId,
      plan: PLAN.FREE,
      plan_status: PLAN_STATUS.NONE,
      plan_source: PLAN_SOURCE.FREE,
      billing_status: BILLING_STATUS.NONE,
      subscription_started_at: null,
      subscription_expires_at: null,
      cancelled_at: null,
      granted_by_admin: null,
      granted_reason: null,
      payment_provider: null,
      payment_reference: null,
      subscription_reference: null,
      external_reference: null,
      referral_code_used: null,
    });
  }
  return resolveBillingState(row);
}

export async function activatePaidPro(input: {
  userId: string;
  paymentId: string;
  externalReference: string | null;
  referralCode: string | null;
  plan: 'mensal' | 'anual';
  approvedAt?: string;
}) {
  const startedAt = input.approvedAt || new Date().toISOString();
  const expiresAtDate = new Date(startedAt);
  expiresAtDate.setUTCDate(expiresAtDate.getUTCDate() + PLAN_DURATION_DAYS[input.plan]);

  await updateBillingProfile(input.userId, {
    plan: PLAN.PRO,
    plan_status: PLAN_STATUS.ACTIVE,
    plan_source: PLAN_SOURCE.PAID,
    billing_status: BILLING_STATUS.ACTIVE,
    subscription_started_at: startedAt,
    subscription_expires_at: expiresAtDate.toISOString(),
    cancelled_at: null,
    granted_by_admin: null,
    granted_reason: null,
    payment_provider: 'mercado_pago',
    payment_reference: input.paymentId,
    external_reference: input.externalReference,
    referral_code_used: input.referralCode,
  });

  await auditLog('billing_paid_activation', {
    userId: input.userId,
    paymentProvider: 'mercado_pago',
    paymentReference: input.paymentId,
    plan: input.plan,
  });
}

export async function grantManualPro(input: { userId: string; adminEmail: string; reason: string | null }) {
  await updateBillingProfile(input.userId, {
    plan: PLAN.PRO,
    plan_status: PLAN_STATUS.ACTIVE,
    plan_source: PLAN_SOURCE.ADMIN,
    billing_status: BILLING_STATUS.MANUAL,
    subscription_status: null,
    subscription_started_at: new Date().toISOString(),
    subscription_expires_at: null,
    cancelled_at: null,
    granted_by_admin: input.adminEmail,
    granted_reason: input.reason,
    playoff_pack_active: false,
    payment_provider: null,
    payment_reference: null,
    subscription_reference: null,
    stripe_subscription_id: null,
    external_reference: null,
  });

  await auditLog('billing_admin_grant', { userId: input.userId, grantedBy: input.adminEmail, reason: input.reason });
}

export async function revokeManualPro(input: { userId: string; adminEmail: string; reason: string | null }) {
  await updateBillingProfile(input.userId, {
    plan: PLAN.FREE,
    plan_status: PLAN_STATUS.NONE,
    plan_source: PLAN_SOURCE.FREE,
    billing_status: BILLING_STATUS.NONE,
    subscription_status: null,
    subscription_started_at: null,
    subscription_expires_at: null,
    cancelled_at: new Date().toISOString(),
    granted_by_admin: null,
    granted_reason: null,
    playoff_pack_active: false,
    payment_provider: null,
    payment_reference: null,
    subscription_reference: null,
    stripe_subscription_id: null,
    external_reference: null,
  });

  await auditLog('billing_admin_revoke', { userId: input.userId, revokedBy: input.adminEmail, reason: input.reason });
}

export async function cancelPaidSubscription(userId: string) {
  const state = await getBillingState(userId);

  if (!state.isPaidPro) {
    return { cancelled: false, reason: 'not_paid_subscription', state };
  }

  const nowIso = new Date().toISOString();
  await auditLog('billing_cancellation_requested', { userId });

  await updateBillingProfile(userId, {
    plan_status: PLAN_STATUS.CANCELLED,
    billing_status: BILLING_STATUS.CANCELLED,
    cancelled_at: nowIso,
  });

  await auditLog('billing_cancellation_applied', { userId, keepsAccessUntil: state.subscriptionExpiresAt });
  return { cancelled: true, accessUntil: state.subscriptionExpiresAt };
}
