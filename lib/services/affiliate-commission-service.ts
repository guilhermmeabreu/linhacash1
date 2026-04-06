import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function roundCurrency(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(2));
}

export async function createCommissionForApprovedPayment(input: {
  referralCode: string;
  userId: string;
  paymentId: string;
  plan: 'mensal' | 'anual';
  grossAmount: number;
  approvedAt?: string;
}) {
  const referralCode = input.referralCode.trim().toUpperCase();

  const { data: referral, error: referralError } = await supabase
    .from('referral_codes')
    .select('code, influencer_name, commission_pct, active')
    .eq('code', referralCode)
    .maybeSingle();

  if (referralError) throw referralError;
  if (!referral || !referral.active) {
    return { created: false as const, reason: 'referral_not_found_or_inactive' as const };
  }

  const grossAmount = roundCurrency(input.grossAmount);
  const commissionPct = roundCurrency(Number(referral.commission_pct || 0));
  const commissionAmount = roundCurrency((grossAmount * commissionPct) / 100);

  const payload = {
    referral_code: referral.code,
    influencer_name: referral.influencer_name,
    user_id: input.userId,
    payment_id: input.paymentId,
    plan: input.plan,
    gross_amount: grossAmount,
    commission_pct: commissionPct,
    commission_amount: commissionAmount,
    status: 'pending',
    approved_at: input.approvedAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('affiliate_commissions')
    .upsert(payload, { onConflict: 'payment_id', ignoreDuplicates: true })
    .select('id')
    .maybeSingle();

  if (error) throw error;
  return {
    created: !!data,
    reason: data ? 'created' : ('duplicate_payment' as const),
    commissionAmount,
    commissionPct,
    grossAmount,
  };
}
