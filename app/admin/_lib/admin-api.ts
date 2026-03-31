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
  created_at: string;
  profiles?: { name: string; email: string };
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

export const adminApi = {
  loadAll() {
    return Promise.all([
      json<Stats>('/api/admin/stats'),
      json<Profile[]>('/api/admin/users'),
      json<ReferralCode[]>('/api/admin/referrals'),
      json<ReferralUse[]>('/api/admin/referral-uses'),
      json<Array<{ created_at: string; status: string; games_synced: number }>>('/api/admin/sync-logs').catch(() => []),
    ]);
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
