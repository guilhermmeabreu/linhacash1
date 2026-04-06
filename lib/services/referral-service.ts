import { createClient } from '@supabase/supabase-js';
import { ValidationError } from '@/lib/http/errors';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

type ReferralCodeRow = {
  code: string;
  active: boolean;
  influencer_name: string | null;
  commission_pct: number | null;
};

function normalizeReferralCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  return normalized && /^[A-Z0-9]{2,20}$/.test(normalized) ? normalized : null;
}

export async function requireActiveReferralCode(code: string): Promise<ReferralCodeRow> {
  const normalized = normalizeReferralCode(code);
  if (!normalized) throw new ValidationError('Código de indicação inválido');

  const { data, error } = await supabase
    .from('referral_codes')
    .select('code,active,influencer_name,commission_pct')
    .eq('code', normalized)
    .maybeSingle();

  if (error) throw error;
  if (!data || !data.active) throw new ValidationError('Código de indicação inválido ou inativo');
  return data as ReferralCodeRow;
}

export async function findExistingReferralCode(code: string | null | undefined): Promise<ReferralCodeRow | null> {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from('referral_codes')
    .select('code,active,influencer_name,commission_pct')
    .eq('code', normalized)
    .maybeSingle();

  if (error) throw error;
  return data ? (data as ReferralCodeRow) : null;
}

