import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminUser } from '@/lib/auth/authorization';
import { AppError } from '@/lib/http/errors';
import { fail, internalError, options } from '@/lib/http/responses';
import { BillingProfileRow, resolveBillingState } from '@/lib/services/billing-domain';
import { getCachedValue } from '@/lib/cache/memory-cache';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const MONTHLY_PRO_PRICE = 24.9;
type StatsProfileRow = BillingProfileRow & { created_at: string; name: string | null; email: string | null; id: string };

export async function GET(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  try {
    await requireAdminUser(req);
    const payload = await getCachedValue('admin:stats', 30_000, async () => {
      const [profiles, games, players] = await Promise.all([
        supabase
          .from('profiles')
          .select('id,plan,plan_status,plan_source,billing_status,subscription_started_at,subscription_expires_at,cancelled_at,granted_by_admin,granted_reason,payment_provider,payment_reference,subscription_reference,external_reference,referral_code_used,created_at,name,email')
          .order('created_at', { ascending: false }),
        supabase.from('games').select('id', { count: 'exact' }),
        supabase.from('players').select('id', { count: 'exact' }),
      ]);

      const rows = (profiles.data || []) as StatsProfileRow[];
      const billingStates = rows.map((row) => resolveBillingState(row));
      const total_users = rows.length;
      const pro_paid_users = billingStates.filter((b) => b.isPaidPro).length;
      const pro_admin_users = billingStates.filter((b) => b.isManualPro).length;
      const pro_users = pro_paid_users + pro_admin_users;
      const free_users = total_users - pro_users;
      const estimated_monthly_revenue_brl = Number((pro_paid_users * MONTHLY_PRO_PRICE).toFixed(2));

      return {
        total_users,
        pro_users,
        pro_paid_users,
        pro_admin_users,
        free_users,
        total_games: games.count || 0,
        total_players: players.count || 0,
        estimated_monthly_revenue_brl,
        recent_signups: rows.slice(0, 10),
      };
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof AppError) return fail(error, origin);
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
