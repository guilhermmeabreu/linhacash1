import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

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
  | 'affiliate_commission_upserted'
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
    await supabase.from('audit_logs').insert(entry);
  } catch {
    console.info('[AUDIT]', JSON.stringify(entry));
  }
}
