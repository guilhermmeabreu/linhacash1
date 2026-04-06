export interface Billing {
  planSource: string;
  planStatus: string;
  billingStatus: string;
  subscriptionExpiresAt: string | null;
  isPaidPro: boolean;
  isManualPro: boolean;
  hasProAccess: boolean;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  plan: string;
  created_at: string;
  referral_code_used?: string;
  billing?: Billing;
}

export interface ReferralCode {
  id: number;
  code: string;
  influencer_name: string;
  uses: number;
  commission_pct: number;
  active: boolean;
}

export interface ReferralUse {
  id: number;
  code: string;
  user_id: string;
  payment_id?: string | null;
  created_at: string;
  profiles?: {
    name: string;
    email: string;
    plan_source?: string | null;
    plan_status?: string | null;
    billing_status?: string | null;
    payment_reference?: string | null;
    granted_by_admin?: string | null;
  };
}

export interface Stats {
  total_users: number;
  pro_users: number;
  pro_paid_users: number;
  pro_admin_users: number;
  free_users: number;
  total_games: number;
  total_players: number;
  estimated_monthly_revenue_brl: number;
  recent_signups: Array<Profile & { billing?: Billing }>;
  new_users_today: number;
  new_users_7d: number;
  new_users_30d: number;
  recent_cancellations: Array<{ id: string; email: string | null; cancelled_at: string | null }>;
}

export interface ProductInsights {
  eventsAvailable: boolean;
  periodDays: number;
  totalEvents: number;
  gameOpens: number;
  playerModalOpens: number;
  upgradeClicks: number;
  lockedProFeatureClicks: number;
  mostUsedMarkets: Array<{ market: string; count: number }>;
  recentEventSummaries: Array<{ event_name: string; count: number }>;
  recentEvents: Array<{ event_name: string; created_at: string; metadata: Record<string, unknown> | null }>;
}

export interface OperationsInsights {
  latestSyncStatus: string | null;
  latestSyncTimestamp: string | null;
  syncFreshness: 'fresh' | 'stale' | 'critical' | 'unknown';
  syncFreshnessLabel: string;
  recentImportantEvents: Array<{ event: string; created_at: string; details: Record<string, unknown> | null }>;
}

export interface AdminActionInsights {
  recentUserActions: Array<{ action: string; created_at: string; context: string }>;
  recentBillingAdminChanges: Array<{ event: string; created_at: string; details: Record<string, unknown> | null }>;
  recentResetsDeletions: Array<{ event: string; created_at: string; details: Record<string, unknown> | null }>;
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload?.error || payload?.message || 'Erro na requisição');
  }

  return res.json();
}

export interface AdminOverviewPayload {
  stats: Stats;
  users: Profile[];
  referrals: ReferralCode[];
  referralUses: ReferralUse[];
  syncHistory: Array<{ created_at: string; status: string; games_synced: number }>;
  productInsights: ProductInsights;
  operationsInsights: OperationsInsights;
  adminActionInsights: AdminActionInsights;
}

export const adminApi = {
  loadAll() {
    return json<AdminOverviewPayload>('/api/admin/overview');
  },
  toggleManualPro(id: string, enable: boolean) {
    return json('/api/admin/users', {
      method: 'PATCH',
      body: JSON.stringify({ id, action: enable ? 'grant_manual_pro' : 'revoke_manual_pro' }),
    });
  },
  deleteUser(id: string) {
    return json('/api/admin/users', { method: 'DELETE', body: JSON.stringify({ id }) });
  },
  resetPassword(email: string) {
    return json('/api/admin/users', { method: 'PUT', body: JSON.stringify({ email }) });
  },
  runSync() {
    return json<{ message?: string; error?: string }>('/api/sync');
  },
  createReferral(code: string, influencer_name: string) {
    return json('/api/admin/referrals', {
      method: 'POST',
      body: JSON.stringify({ code: code.toUpperCase(), influencer_name }),
    });
  },
  toggleReferral(id: number, active: boolean) {
    return json('/api/admin/referrals', {
      method: 'PATCH',
      body: JSON.stringify({ id, active: !active }),
    });
  },
  deleteReferral(id: number) {
    return json('/api/admin/referrals', { method: 'DELETE', body: JSON.stringify({ id }) });
  },
  logout() {
    return fetch('/api/admin/auth', { method: 'DELETE' });
  },
};
