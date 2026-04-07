import { createClient } from '@supabase/supabase-js';
import { auditLog } from '@/lib/services/audit-log-service';

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase env vars are not configured');
  }

  supabaseClient = createClient(url, serviceKey);
  return supabaseClient;
}

export async function deleteOwnAccount(userId: string, email: string) {
  const supabase = getSupabase();
  await supabase.from('referral_uses').delete().eq('user_id', userId);
  const { error: favoritesDeleteError } = await supabase.from('favorites').delete().eq('user_id', userId);
  if (favoritesDeleteError) {
    // favorites table is optional in some environments; ignore this cleanup error
  }
  await supabase.from('profiles').delete().eq('id', userId);

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) throw error;

  await (supabase as any)
    .from('account_deletions')
    .insert({ user_email: email, user_id: userId, completed: true, reason: 'self_service_request' });
  await auditLog('account_deleted', { userId });
}
