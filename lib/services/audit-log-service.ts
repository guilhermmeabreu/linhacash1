import { createClient } from '@supabase/supabase-js';

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) return null;

  supabaseClient = createClient(url, serviceKey);
  return supabaseClient;
}

type AuditEvent =
  | 'admin_login_success'
  | 'admin_login_failed'
  | 'admin_logout'
  | 'plan_change'
  | 'password_reset'
  | 'account_deleted'
  | 'sync_execution'
  | 'webhook_event'
  | 'billing_paid_activation'
  | 'billing_admin_grant'
  | 'billing_admin_revoke'
  | 'billing_cancellation_requested'
  | 'billing_cancellation_applied'
  | 'billing_status_changed'
  | 'support_message_sent'
  | 'security_rate_limited'
  | 'auth_security_event';

export async function auditLog(event: AuditEvent, details: Record<string, unknown>) {
  const entry = {
    event,
    details,
    created_at: new Date().toISOString(),
  };

  try {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase unavailable');
    await (supabase as any).from('audit_logs').insert(entry);
  } catch {
    console.info('[AUDIT]', JSON.stringify(entry));
  }
}
