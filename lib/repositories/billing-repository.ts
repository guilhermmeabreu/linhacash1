import { createClient } from '@supabase/supabase-js';
import { BillingProfileRow } from '@/lib/services/billing-domain';

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase env vars are not configured');
  }

  supabaseClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return supabaseClient;
}

const BILLING_COLUMNS = `id,plan,subscription_status,playoff_pack_active,billing_updated_at,plan_status,plan_source,billing_status,subscription_started_at,subscription_expires_at,cancelled_at,granted_by_admin,granted_reason,payment_provider,payment_reference,subscription_reference,external_reference,referral_code_used`;

export async function getBillingProfileByUserId(userId: string): Promise<BillingProfileRow | null> {
  const supabase = getSupabase();
  const { data, error } = await (supabase as any).from('profiles').select(BILLING_COLUMNS).eq('id', userId).maybeSingle();
  if (error) throw error;
  return (data as BillingProfileRow | null) || null;
}

export async function updateBillingProfile(userId: string, patch: Record<string, unknown>) {
  const supabase = getSupabase();
  const { error } = await (supabase as any).from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

export async function getAllBillingProfiles() {
  const supabase = getSupabase();
  const { data, error } = await (supabase as any)
    .from('profiles')
    .select(`id,email,name,created_at,${BILLING_COLUMNS}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listBillingProfilesForStats() {
  const supabase = getSupabase();
  const { data, error } = await (supabase as any)
    .from('profiles')
    .select(`id,created_at,${BILLING_COLUMNS}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
