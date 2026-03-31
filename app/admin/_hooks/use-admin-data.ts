'use client';

import { useCallback, useMemo, useState } from 'react';
import { adminApi, Profile, ReferralCode, ReferralUse, Stats } from '../_lib/admin-api';

export function useAdminData() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [referrals, setReferrals] = useState<ReferralCode[]>([]);
  const [referralUses, setReferralUses] = useState<ReferralUse[]>([]);
  const [syncHistory, setSyncHistory] = useState<Array<{ created_at: string; status: string; games_synced: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.loadAll();
      setStats(data.stats);
      setUsers(data.users);
      setReferrals(data.referrals);
      setReferralUses(data.referralUses);
      setSyncHistory(Array.isArray(data.syncHistory) ? data.syncHistory : []);
    } catch {
      setFeedback({ type: 'error', message: 'Não foi possível carregar o painel.' });
    } finally {
      setLoading(false);
    }
  }, []);

  const actions = useMemo(
    () => ({
      async toggleManualPro(user: Profile) {
        try {
          const enable = !user.billing?.isManualPro;
          await adminApi.toggleManualPro(user.id, enable);
          setFeedback({ type: 'success', message: enable ? 'Pro Admin concedido.' : 'Pro Admin revogado.' });
          await loadAll();
        } catch {
          setFeedback({ type: 'error', message: 'Falha ao atualizar plano.' });
        }
      },
      async deleteUser(userId: string) {
        await adminApi.deleteUser(userId);
        setUsers((curr) => curr.filter((user) => user.id !== userId));
      },
      async resetPassword(email: string) {
        await adminApi.resetPassword(email);
        setFeedback({ type: 'success', message: `E-mail de redefinição enviado para ${email}.` });
      },
      async createReferral(code: string, influencerName: string) {
        await adminApi.createReferral(code, influencerName);
        await loadAll();
      },
      async toggleReferral(id: number, active: boolean) {
        await adminApi.toggleReferral(id, active);
        setReferrals((curr) => curr.map((ref) => (ref.id === id ? { ...ref, active: !active } : ref)));
      },
      async deleteReferral(id: number) {
        await adminApi.deleteReferral(id);
        setReferrals((curr) => curr.filter((ref) => ref.id !== id));
      },
      async runSync() {
        const data = await adminApi.runSync();
        setFeedback({ type: data.error ? 'error' : 'success', message: data.error || data.message || 'Sync concluído.' });
        await loadAll();
      },
      clearFeedback() {
        setFeedback(null);
      },
    }),
    [loadAll],
  );

  return { stats, users, referrals, referralUses, syncHistory, loading, feedback, loadAll, actions };
}
