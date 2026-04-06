import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const FALLBACK_PLAN_PRICE: Record<'mensal' | 'anual', number> = {
  mensal: 24.9,
  anual: 197,
};

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

export async function upsertAffiliateCommission(input: {
  code: string;
  userId: string;
  paymentId: string;
  plan: 'mensal' | 'anual';
  transactionAmount: number | null;
  paidAt: string | null;
}) {
  const { data: referralCode } = await supabase
    .from('referral_codes')
    .select('code,commission_pct,active')
    .eq('code', input.code)
    .maybeSingle();

  if (!referralCode || !referralCode.active) return { created: false, reason: 'inactive_or_missing_code' as const };

  const commissionPct = Number(referralCode.commission_pct || 0);
  const baseAmount = input.transactionAmount && Number.isFinite(input.transactionAmount) && input.transactionAmount > 0
    ? input.transactionAmount
    : FALLBACK_PLAN_PRICE[input.plan];
  const commissionAmount = roundMoney(baseAmount * (commissionPct / 100));

  const payload = {
    code: referralCode.code,
    user_id: input.userId,
    payment_id: input.paymentId,
    commission_amount: commissionAmount,
    commission_status: 'earned',
    paid_at: null as string | null,
    payout_note: null as string | null,
    updated_at: new Date().toISOString(),
    created_at: input.paidAt || new Date().toISOString(),
  };

  const { error } = await supabase.from('affiliate_commissions').upsert(payload, { onConflict: 'payment_id' });
  if (error) throw error;

  return { created: true, commissionAmount, commissionPct };
}

