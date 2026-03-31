import { createClient } from '@supabase/supabase-js';
import { auditLog } from '@/lib/services/audit-log-service';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function deleteOwnAccount(userId: string, email: string) {
  await supabase.from('referral_uses').delete().eq('user_id', userId);
  const { error: favoritesDeleteError } = await supabase.from('favorites').delete().eq('user_id', userId);
  if (favoritesDeleteError) {
    // favorites table is optional in some environments; ignore this cleanup error
  }
  await supabase.from('profiles').delete().eq('id', userId);

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) throw error;

  await supabase.from('account_deletions').insert({ user_email: email, user_id: userId, completed: true, reason: 'self_service_request' });
  await auditLog('account_deleted', { userId });
}
