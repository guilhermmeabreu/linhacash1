'use client';

import { useCallback, useMemo, useState } from 'react';
import { AdminActionInsights, AdminApiError, adminApi, AffiliateCommission, OperationsInsights, ProductInsights, Profile, ReferralCode, ReferralUse, Stats, SyncStage } from '../_lib/admin-api';

export function useAdminData() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [referrals, setReferrals] = useState<ReferralCode[]>([]);
  const [referralUses, setReferralUses] = useState<ReferralUse[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [syncHistory, setSyncHistory] = useState<Array<{
    id: number | string;
    status: string;
    status_label: string;
    message: string;
    started_at: string | null;
    finished_at: string | null;
    created_at: string;
    duration_ms: number | null;
    games_synced: number;
    players_synced: number;
    player_stats_synced: number;
    errors: string | null;
    sync_mode: string | null;
    route_source: string | null;
    request_id: string | null;
  }>>([]);
  const [productInsights, setProductInsights] = useState<ProductInsights | null>(null);
  const [operationsInsights, setOperationsInsights] = useState<OperationsInsights | null>(null);
  const [adminActionInsights, setAdminActionInsights] = useState<AdminActionInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncCurrentStage, setSyncCurrentStage] = useState<SyncStage | 'full' | null>(null);
  const [syncStageMessages, setSyncStageMessages] = useState<Array<{ stage: SyncStage; type: 'success' | 'error'; message: string }>>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.loadAll();
      setStats(data.stats);
      setUsers(data.users);
      setReferrals(data.referrals);
      setReferralUses(data.referralUses);
      setCommissions(data.commissions || []);
      setSyncHistory(Array.isArray(data.syncHistory) ? data.syncHistory : []);
      setProductInsights(data.productInsights || null);
      setOperationsInsights(data.operationsInsights || null);
      setAdminActionInsights(data.adminActionInsights || null);
    } catch (error) {
      if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) {
        setFeedback({ type: 'error', message: 'Sua sessão de admin expirou. Faça login novamente.' });
        throw error;
      }
      setFeedback({ type: 'error', message: 'Não foi possível carregar o painel.' });
      throw error;
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
      async runSyncStage(stage: SyncStage) {
        if (syncRunning) return;

        setSyncRunning(true);
        setSyncCurrentStage(stage);
        try {
          const data = await adminApi.runSync({ stage });
          const statusLabel = data.status === 'success' ? 'success' : data.status === 'skipped' ? 'skipped' : 'failure';
          const message = data.error || data.message || 'Sync concluído.';
          setSyncStageMessages((curr) => [...curr, { stage, type: data.status === 'error' ? 'error' : 'success', message }]);
          setFeedback({
            type: data.status === 'error' ? 'error' : 'success',
            message: `Sync ${stage} ${statusLabel}: ${message}`,
          });
          await loadAll();
        } finally {
          setSyncCurrentStage(null);
          setSyncRunning(false);
        }
      },
      async runFullSync() {
        if (syncRunning) return;
        setSyncRunning(true);
        setSyncCurrentStage('full');
        setSyncStageMessages([]);
        try {
          const orderedStages: SyncStage[] = ['games', 'stats', 'metrics'];
          for (const stage of orderedStages) {
            setSyncCurrentStage(stage);
            const data = await adminApi.runSync({ stage });
            const message = data.error || data.message || 'Sync concluído.';
            const isError = data.status === 'error';
            setSyncStageMessages((curr) => [...curr, { stage, type: isError ? 'error' : 'success', message }]);
            if (isError) {
              setFeedback({ type: 'error', message: `Falha no estágio ${stage}: ${message}` });
              return;
            }
          }
          setFeedback({ type: 'success', message: 'Sync completo em estágios concluído.' });
          await loadAll();
        } finally {
          setSyncCurrentStage(null);
          setSyncRunning(false);
        }
      },
      async updateCommissionStatus(id: number, commissionStatus: 'pending' | 'earned' | 'paid', payoutNote?: string) {
        await adminApi.updateCommissionStatus(id, commissionStatus, payoutNote);
        setFeedback({ type: 'success', message: commissionStatus === 'paid' ? 'Comissão marcada como paga.' : 'Status de comissão atualizado.' });
        await loadAll();
      },
      clearFeedback() {
        setFeedback(null);
      },
    }),
    [loadAll, syncRunning],
  );

  return {
    stats,
    users,
    referrals,
    referralUses,
    commissions,
    syncHistory,
    productInsights,
    operationsInsights,
    adminActionInsights,
    loading,
    syncRunning,
    syncCurrentStage,
    syncStageMessages,
    feedback,
    loadAll,
    actions,
  };
}
