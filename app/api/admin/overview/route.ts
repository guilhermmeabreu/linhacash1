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
const MONTHLY_PRO_PRICE_BRL = 24.9;
const ANNUAL_PRO_PRICE_BRL = 197;
const PLAYOFF_PRICE_BRL = 29.9;
const STRIPE_NATIONAL_PERCENT = 0.0399;
const STRIPE_NATIONAL_FIXED_BRL = 0.39;
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
  event: string | null;
  created_at: string | null;
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

type SyncLogRow = {
  id: number | string;
  status: string | null;
  message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  games_synced: number | null;
  players_synced: number | null;
  player_stats_synced: number | null;
  errors: string | null;
  sync_mode: string | null;
  route_source: string | null;
  request_id: string | null;
  duration_ms: number | null;
};

type SyncHealthStatus = 'running' | 'success' | 'error' | 'skipped_lock' | 'recovered_stale_run' | 'unknown';

function toSyncHealthStatus(log: SyncLogRow): SyncHealthStatus {
  const status = (log.status || '').toLowerCase();
  const message = (log.message || '').toLowerCase();
  if (status === 'running' || status === 'in_progress') return 'running';
  if (status === 'success') return 'success';
  if (message.includes('recovered stale running sync log')) return 'recovered_stale_run';
  if (status === 'error') return 'error';
  if (status === 'skipped') return 'skipped_lock';
  return 'unknown';
}

function toSyncStatusLabel(status: SyncHealthStatus): string {
  switch (status) {
    case 'running':
      return 'Running';
    case 'success':
      return 'Success';
    case 'error':
      return 'Error';
    case 'skipped_lock':
      return 'Skipped (lock)';
    case 'recovered_stale_run':
      return 'Recovered stale run';
    default:
      return 'Unknown';
  }
}

function resolveSyncTimestamp(log: SyncLogRow | null): string | null {
  if (!log) return null;
  return log.finished_at || log.started_at || log.created_at || null;
}

function computeDurationMs(log: SyncLogRow): number | null {
  if (typeof log.duration_ms === 'number' && Number.isFinite(log.duration_ms)) return Math.max(0, log.duration_ms);
  if (!log.started_at || !log.finished_at) return null;
  const startedAt = new Date(log.started_at).getTime();
  const finishedAt = new Date(log.finished_at).getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt)) return null;
  return Math.max(0, finishedAt - startedAt);
}

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

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
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
          .select('id,name,email,plan,subscription_status,playoff_pack_active,billing_updated_at,created_at,referral_code_used,plan_status,plan_source,billing_status,subscription_started_at,subscription_expires_at,cancelled_at,granted_by_admin,granted_reason,payment_provider,payment_reference,subscription_reference,external_reference')
          .order('created_at', { ascending: false }),
        supabase.from('games').select('id', { count: 'exact' }),
        supabase.from('players').select('id', { count: 'exact' }),
        supabase.from('referral_codes').select('*').order('uses', { ascending: false }),
        supabase
          .from('referral_uses')
          .select('id,code,user_id,payment_id,created_at,profiles(name,email,plan_source,plan_status,billing_status,payment_reference,granted_by_admin)')
          .order('created_at', { ascending: false }),
        supabase.from('affiliate_commissions').select('*').order('created_at', { ascending: false }),
        supabase.from('sync_logs').select('*').order('created_at', { ascending: false }).limit(20),
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
      const paidMonthlyUsers = billingStates.filter((billing) => billing.isPaidPro && billing.paidPlanType === 'monthly').length;
      const paidAnnualUsers = billingStates.filter((billing) => billing.isPaidPro && billing.paidPlanType === 'annual').length;
      const paidPlayoffUsers = billingStates.filter((billing) => billing.isPaidPro && billing.paidPlanType === 'playoff').length;
      const estimatedMonthlyRecurringRevenue = (paidMonthlyUsers * MONTHLY_PRO_PRICE_BRL) + (paidAnnualUsers * (ANNUAL_PRO_PRICE_BRL / 12));
      const monthlyCashCollected = paidMonthlyUsers * MONTHLY_PRO_PRICE_BRL;
      const annualCashCollected = paidAnnualUsers * ANNUAL_PRO_PRICE_BRL;
      const playoffRevenue = paidPlayoffUsers * PLAYOFF_PRICE_BRL;
      const paidTransactions = paidMonthlyUsers + paidAnnualUsers + paidPlayoffUsers;
      const grossRevenue = monthlyCashCollected + annualCashCollected + playoffRevenue;
      const recentCancellations = users
        .filter((row) => row.cancelled_at || (row.billing.planStatus === 'cancelled' && row.billing.billingUpdatedAt))
        .slice(0, 8)
        .map((row) => ({
          id: row.id,
          email: row.email,
          cancelled_at: row.cancelled_at || row.billing.billingUpdatedAt,
        }));

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

      const syncHistoryRows = (syncLogsResult.data || []) as SyncLogRow[];
      const runningSync = syncHistoryRows.find((entry) => toSyncHealthStatus(entry) === 'running') || null;
      const latestSync = syncHistoryRows[0] || null;
      const lastSuccessSync = syncHistoryRows.find((entry) => toSyncHealthStatus(entry) === 'success') || null;
      const lastFailedSync = syncHistoryRows.find((entry) => {
        const normalized = toSyncHealthStatus(entry);
        return normalized === 'error' || normalized === 'recovered_stale_run';
      }) || null;
      const freshness = getSyncFreshness(resolveSyncTimestamp(lastSuccessSync));
      const syncHistory = syncHistoryRows.slice(0, 10).map((entry) => {
        const normalizedStatus = toSyncHealthStatus(entry);
        return {
          id: entry.id,
          status: normalizedStatus,
          status_label: toSyncStatusLabel(normalizedStatus),
          message: entry.message || '',
          started_at: entry.started_at || entry.created_at,
          finished_at: entry.finished_at,
          created_at: entry.created_at || entry.started_at || new Date().toISOString(),
          duration_ms: computeDurationMs(entry),
          games_synced: Number(entry.games_synced || 0),
          players_synced: Number(entry.players_synced || 0),
          player_stats_synced: Number(entry.player_stats_synced || 0),
          errors: entry.errors,
          sync_mode: entry.sync_mode || null,
          route_source: entry.route_source || null,
          request_id: entry.request_id || null,
        };
      });
      const audits = ((auditResult.data || []) as AuditRow[]).filter(
        (entry): entry is AuditRow & { event: string; created_at: string } =>
          typeof entry.event === 'string' && entry.event.length > 0 && typeof entry.created_at === 'string' && entry.created_at.length > 0,
      );
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
      const totalAffiliateCommissions = commissions.reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);
      const affiliateDrivenPaidConversions = commissions.length;
      const estimatedStripeFees = (grossRevenue * STRIPE_NATIONAL_PERCENT) + (paidTransactions * STRIPE_NATIONAL_FIXED_BRL);
      const netRevenue = grossRevenue - estimatedStripeFees - totalAffiliateCommissions;
      const topReferralCodesByConversion = [...commissions
        .reduce((acc, item) => {
          acc.set(item.code, (acc.get(item.code) || 0) + 1);
          return acc;
        }, new Map<string, number>())
        .entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([code, conversions]) => ({ code, conversions }));
      const topReferralCodesByCommissionAmount = [...commissions
        .reduce((acc, item) => {
          acc.set(item.code, (acc.get(item.code) || 0) + Number(item.commission_amount || 0));
          return acc;
        }, new Map<string, number>())
        .entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([code, commission_amount_brl]) => ({ code, commission_amount_brl: roundMoney(commission_amount_brl) }));

      return {
        stats: {
          total_users,
          pro_users,
          pro_paid_users,
          pro_admin_users,
          free_users,
          paid_monthly_users: paidMonthlyUsers,
          paid_annual_users: paidAnnualUsers,
          paid_playoff_users: paidPlayoffUsers,
          total_games: gamesResult.count || 0,
          total_players: playersResult.count || 0,
          estimated_monthly_revenue_brl: roundMoney(estimatedMonthlyRecurringRevenue),
          estimated_monthly_recurring_revenue_brl: roundMoney(estimatedMonthlyRecurringRevenue),
          monthly_cash_collected_brl: roundMoney(monthlyCashCollected),
          annual_cash_collected_brl: roundMoney(annualCashCollected),
          playoff_revenue_brl: roundMoney(playoffRevenue),
          gross_revenue_brl: roundMoney(grossRevenue),
          estimated_stripe_fees_brl: roundMoney(estimatedStripeFees),
          estimated_affiliate_commissions_brl: roundMoney(totalAffiliateCommissions),
          net_revenue_brl: roundMoney(netRevenue),
          total_affiliate_commission_paid_brl: roundMoney(commissionsPaid),
          total_affiliate_commission_earned_brl: roundMoney(commissionsEarned),
          total_affiliate_commission_pending_brl: roundMoney(commissionsPending),
          affiliate_paid_conversions: affiliateDrivenPaidConversions,
          top_referral_codes_by_conversion: topReferralCodesByConversion,
          top_referral_codes_by_commission_amount: topReferralCodesByCommissionAmount,
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
          latestSyncStatus: latestSync ? toSyncStatusLabel(toSyncHealthStatus(latestSync)) : null,
          latestSyncTimestamp: resolveSyncTimestamp(latestSync),
          latestSyncMessage: latestSync?.message || null,
          syncRunning: Boolean(runningSync),
          currentRunningSince: resolveSyncTimestamp(runningSync),
          lastSuccessAt: resolveSyncTimestamp(lastSuccessSync),
          lastFailureAt: resolveSyncTimestamp(lastFailedSync),
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
