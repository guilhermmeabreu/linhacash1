import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminUser } from '@/lib/auth/authorization';
import { AppError } from '@/lib/http/errors';
import { fail, internalError, options } from '@/lib/http/responses';
import { BillingProfileRow, resolveBillingState } from '@/lib/services/billing-domain';
import { getCachedValue } from '@/lib/cache/memory-cache';
import { getIP, rateLimitDetailed } from '@/lib/rate-limit';
import { buildRequestContext, logRouteError, logSecurityEvent } from '@/lib/observability';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const MONTHLY_PRO_PRICE = 24.9;
const ADMIN_OVERVIEW_TTL_MS = 30_000;

type AdminProfileRow = BillingProfileRow & {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
  cancelled_at: string | null;
};

type EventRow = {
  event_name: string;
  created_at: string;
  metadata: { market?: unknown; context?: unknown } | null;
};

type AuditRow = {
  event: string;
  created_at: string;
  details: Record<string, unknown> | null;
};

type CommissionRow = {
  id: number;
  code: string;
  user_id: string;
  payment_id: string | null;
  commission_amount: number | null;
  commission_status: string | null;
  paid_at: string | null;
  payout_note: string | null;
  created_at: string;
  updated_at: string | null;
};

function countSince(users: Array<{ created_at: string }>, days: number) {
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  return users.filter((user) => new Date(user.created_at).getTime() >= threshold).length;
}

function getSyncFreshness(latestSyncTimestamp: string | null) {
  if (!latestSyncTimestamp) return { level: 'unknown' as const, label: 'Sem sincronização registrada' };
  const ageMs = Date.now() - new Date(latestSyncTimestamp).getTime();
  if (ageMs <= 6 * 60 * 60 * 1000) return { level: 'fresh' as const, label: 'Atualizado nas últimas 6h' };
  if (ageMs <= 24 * 60 * 60 * 1000) return { level: 'stale' as const, label: 'Última sync entre 6h e 24h' };
  return { level: 'critical' as const, label: 'Última sync há mais de 24h' };
}

function toRecentAction(event: EventRow) {
  const metadata = event.metadata || {};
  const market = typeof metadata.market === 'string' ? metadata.market : null;
  const context = typeof metadata.context === 'string' ? metadata.context : null;
  const suffix = [market, context].filter(Boolean).join(' · ');
  return {
    action: event.event_name,
    created_at: event.created_at,
    context: suffix || 'sem contexto',
  };
}

export async function GET(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  const context = buildRequestContext(req, { route: '/api/admin/overview' });

  try {
    const admin = await requireAdminUser(req);
    const rate = await rateLimitDetailed(`admin:overview:${admin.email}:${getIP(req)}`, 45, 60_000);
    if (!rate.allowed) {
      logSecurityEvent('route_rate_limited', { ...context, adminEmail: admin.email, retryAfterSeconds: rate.retryAfterSeconds });
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many admin overview requests'), origin);
    }

    const payload = await getCachedValue('admin:overview', ADMIN_OVERVIEW_TTL_MS, async () => {
      const [profilesResult, gamesResult, playersResult, referralsResult, referralUsesResult, commissionsResult, syncLogsResult, eventsResult, auditResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id,name,email,plan,created_at,referral_code_used,plan_status,plan_source,billing_status,subscription_started_at,subscription_expires_at,cancelled_at,granted_by_admin,granted_reason,payment_provider,payment_reference,subscription_reference,external_reference')
          .order('created_at', { ascending: false }),
        supabase.from('games').select('id', { count: 'exact' }),
        supabase.from('players').select('id', { count: 'exact' }),
        supabase.from('referral_codes').select('*').order('uses', { ascending: false }),
        supabase
          .from('referral_uses')
          .select('id,code,user_id,payment_id,created_at,profiles(name,email,plan_source,plan_status,billing_status,payment_reference,granted_by_admin)')
          .order('created_at', { ascending: false }),
        supabase.from('affiliate_commissions').select('*').order('created_at', { ascending: false }),
        supabase.from('sync_logs').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('events').select('event_name,created_at,metadata').order('created_at', { ascending: false }).limit(300),
        supabase.from('audit_logs').select('event,created_at,details').order('created_at', { ascending: false }).limit(50),
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
      const recentCancellations = rows
        .filter((row) => !!row.cancelled_at)
        .slice(0, 8)
        .map((row) => ({ id: row.id, email: row.email, cancelled_at: row.cancelled_at }));

      const eventsAvailable = !eventsResult.error;
      const events = ((eventsResult.data || []) as EventRow[]).filter((event) => !!event.event_name);
      const eventCountByName = new Map<string, number>();
      const marketCount = new Map<string, number>();

      events.forEach((event) => {
        eventCountByName.set(event.event_name, (eventCountByName.get(event.event_name) || 0) + 1);
        const market = event.metadata?.market;
        if (typeof market === 'string' && market.trim()) {
          const key = market.toLowerCase();
          marketCount.set(key, (marketCount.get(key) || 0) + 1);
        }
      });

      const syncHistory = syncLogsResult.data || [];
      const latestSync = syncHistory[0] || null;
      const freshness = getSyncFreshness(latestSync?.created_at || null);
      const audits = (auditResult.data || []) as AuditRow[];
      const commissions = ((commissionsResult.data || []) as CommissionRow[]).map((item) => ({
        ...item,
        commission_status: item.commission_status || 'pending',
        commission_amount: Number(item.commission_amount || 0),
      }));
      const commissionsPaid = commissions
        .filter((item) => item.commission_status === 'paid')
        .reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);
      const commissionsEarned = commissions
        .filter((item) => item.commission_status === 'earned')
        .reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);
      const commissionsPending = commissions
        .filter((item) => item.commission_status === 'pending')
        .reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);
      const affiliateDrivenPaidConversions = commissions.filter((item) => item.commission_status === 'earned' || item.commission_status === 'paid').length;

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
          total_affiliate_commission_paid_brl: Number(commissionsPaid.toFixed(2)),
          total_affiliate_commission_earned_brl: Number(commissionsEarned.toFixed(2)),
          total_affiliate_commission_pending_brl: Number(commissionsPending.toFixed(2)),
          affiliate_paid_conversions: affiliateDrivenPaidConversions,
          recent_signups: users.slice(0, 10),
          new_users_today: countSince(users, 1),
          new_users_7d: countSince(users, 7),
          new_users_30d: countSince(users, 30),
          recent_cancellations: recentCancellations,
        },
        users,
        referrals: referralsResult.data || [],
        referralUses: referralUsesResult.data || [],
        commissions,
        syncHistory,
        productInsights: {
          eventsAvailable,
          periodDays: 30,
          totalEvents: events.length,
          gameOpens: eventCountByName.get('game_opened') || 0,
          playerModalOpens: eventCountByName.get('player_modal_opened') || 0,
          upgradeClicks: eventCountByName.get('upgrade_button_clicked') || 0,
          lockedProFeatureClicks: eventCountByName.get('locked_pro_feature_clicked') || 0,
          mostUsedMarkets: [...marketCount.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([market, count]) => ({ market, count })),
          recentEventSummaries: [...eventCountByName.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([event_name, count]) => ({ event_name, count })),
          recentEvents: events.slice(0, 12),
        },
        operationsInsights: {
          latestSyncStatus: latestSync?.status || null,
          latestSyncTimestamp: latestSync?.created_at || null,
          syncFreshness: freshness.level,
          syncFreshnessLabel: freshness.label,
          recentImportantEvents: audits.slice(0, 10),
        },
        adminActionInsights: {
          recentUserActions: events
            .filter((event) => ['upgrade_button_clicked', 'locked_pro_feature_clicked', 'player_modal_opened', 'game_opened'].includes(event.event_name))
            .slice(0, 10)
            .map(toRecentAction),
          recentBillingAdminChanges: audits
            .filter((event) => event.event.startsWith('billing_') || event.event === 'plan_change')
            .slice(0, 10),
          recentResetsDeletions: audits
            .filter((event) => ['password_reset', 'account_deleted'].includes(event.event))
            .slice(0, 10),
        },
      };
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof AppError) {
      logRouteError('/api/admin/overview', context.requestId, error, { status: error.status, code: error.code });
      return fail(error, origin);
    }
    logRouteError('/api/admin/overview', context.requestId, error, { status: 500 });
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
