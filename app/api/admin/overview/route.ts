import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminUser } from '@/lib/auth/authorization';
import { AppError } from '@/lib/http/errors';
import { fail, internalError, options } from '@/lib/http/responses';
import { BillingProfileRow, resolveBillingState } from '@/lib/services/billing-domain';
import { getCachedValue } from '@/lib/cache/memory-cache';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const MONTHLY_PRO_PRICE = 24.9;
const ADMIN_OVERVIEW_TTL_MS = 30_000;

type AdminProfileRow = BillingProfileRow & {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
};

export async function GET(req: Request) {
  const origin = req.headers.get('origin') || undefined;

  try {
    await requireAdminUser(req);

    const payload = await getCachedValue('admin:overview', ADMIN_OVERVIEW_TTL_MS, async () => {
      const [profilesResult, gamesResult, playersResult, referralsResult, referralUsesResult, syncLogsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id,name,email,plan,created_at,referral_code_used,plan_status,plan_source,billing_status,subscription_started_at,subscription_expires_at,cancelled_at,granted_by_admin,granted_reason,payment_provider,payment_reference,subscription_reference,external_reference')
          .order('created_at', { ascending: false }),
        supabase.from('games').select('id', { count: 'exact' }),
        supabase.from('players').select('id', { count: 'exact' }),
        supabase.from('referral_codes').select('*').order('uses', { ascending: false }),
        supabase.from('referral_uses').select('*, profiles(name, email)').order('created_at', { ascending: false }),
        supabase.from('sync_logs').select('*').order('created_at', { ascending: false }).limit(5),
      ]);

      const rows = (profilesResult.data || []) as AdminProfileRow[];
      const users = rows.map((row) => {
        const billing = resolveBillingState(row);
        return {
          ...row,
          plan: billing.hasProAccess ? 'pro' : 'free',
          billing,
        };
      });

      const billingStates = users.map((user) => user.billing);
      const total_users = users.length;
      const pro_paid_users = billingStates.filter((b) => b.isPaidPro).length;
      const pro_admin_users = billingStates.filter((b) => b.isManualPro).length;
      const pro_users = pro_paid_users + pro_admin_users;
      const free_users = total_users - pro_users;

      return {
        stats: {
          total_users,
          pro_users,
          pro_paid_users,
          pro_admin_users,
          free_users,
          total_games: gamesResult.count || 0,
          total_players: playersResult.count || 0,
          estimated_monthly_revenue_brl: Number((pro_paid_users * MONTHLY_PRO_PRICE).toFixed(2)),
          recent_signups: users.slice(0, 10),
        },
        users,
        referrals: referralsResult.data || [],
        referralUses: referralUsesResult.data || [],
        syncHistory: syncLogsResult.data || [],
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
