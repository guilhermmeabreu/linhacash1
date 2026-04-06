'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminData } from './_hooks/use-admin-data';
import { adminApi, Profile } from './_lib/admin-api';

type AdminTab = 'overview' | 'users' | 'billing' | 'affiliates' | 'operations' | 'security';
const TABS: Array<{ key: AdminTab; label: string }> = [
  { key: 'overview', label: 'Visão geral' },
  { key: 'users', label: 'Usuários' },
  { key: 'billing', label: 'Faturamento' },
  { key: 'affiliates', label: 'Afiliados' },
  { key: 'operations', label: 'Operações' },
  { key: 'security', label: 'Segurança / Logs' },
];

type QueueStatus = 'pending' | 'paid' | 'cancelled' | 'all';

type SortMode = 'recent' | 'oldest' | 'commission_desc' | 'commission_asc' | 'gross_desc' | 'gross_asc';

const PlanBadge = memo(function PlanBadge({ user }: { user: Profile }) {
  if (user.billing?.isManualPro) return <span className="adm-badge admin">PRO ADMIN</span>;
  if (user.billing?.isPaidPro) return <span className="adm-badge paid">PRO PAGO</span>;
  return <span className="adm-badge free">GRÁTIS</span>;
});

const STATUS_LABEL: Record<'pending' | 'paid' | 'cancelled', string> = {
  pending: 'Pendente',
  paid: 'Pago',
  cancelled: 'Cancelada',
};

function AdminSkeleton() {
  return (
    <section className="adm-grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="adm-card">
          <div className="adm-skeleton adm-skeleton-label" />
          <div className="adm-skeleton adm-skeleton-value" />
        </div>
      ))}
    </section>
  );
}

function toMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function toDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

export default function AdminPage() {
  const router = useRouter();
  const {
    stats,
    users,
    referrals,
    syncHistory,
    productInsights,
    operationsInsights,
    adminActionInsights,
    affiliateCommissions,
    loading,
    feedback,
    loadAll,
    actions,
  } = useAdminData();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'pro_paid' | 'pro_admin' | 'free'>('all');
  const [code, setCode] = useState('');
  const [influencer, setInfluencer] = useState('');
  const [affiliateFilters, setAffiliateFilters] = useState({
    influencer: '',
    code: '',
    status: 'all' as QueueStatus,
    plan: 'all',
    userEmail: '',
    query: '',
    from: '',
    to: '',
    sort: 'recent' as SortMode,
  });
  const [selectedInfluencerKey, setSelectedInfluencerKey] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [payoutReference, setPayoutReference] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');

  useEffect(() => {
    loadAll().catch(() => router.push('/admin/login'));
  }, [loadAll, router]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const term = search.toLowerCase();
      const matchSearch = user.name?.toLowerCase().includes(term) || user.email?.toLowerCase().includes(term);
      const matchPlan =
        planFilter === 'all' ||
        (planFilter === 'free' && !user.billing?.hasProAccess) ||
        (planFilter === 'pro_paid' && !!user.billing?.isPaidPro) ||
        (planFilter === 'pro_admin' && !!user.billing?.isManualPro);
      return matchSearch && matchPlan;
    });
  }, [users, search, planFilter]);

  const userEmailById = useMemo(() => {
    return new Map(users.map((u) => [u.id, u.email]));
  }, [users]);

  const commissionRows = useMemo(() => {
    const fromTime = affiliateFilters.from ? new Date(`${affiliateFilters.from}T00:00:00`).getTime() : null;
    const toTime = affiliateFilters.to ? new Date(`${affiliateFilters.to}T23:59:59`).getTime() : null;

    const rows = affiliateCommissions.filter((row) => {
      const email = userEmailById.get(row.user_id) || '';
      const dateMs = new Date(row.created_at).getTime();
      const text = `${row.influencer_name} ${row.referral_code} ${row.payment_id} ${email}`.toLowerCase();
      const plan = row.plan.toLowerCase();

      const matchInfluencer = !affiliateFilters.influencer || row.influencer_name.toLowerCase().includes(affiliateFilters.influencer.toLowerCase());
      const matchCode = !affiliateFilters.code || row.referral_code.toLowerCase().includes(affiliateFilters.code.toLowerCase());
      const matchStatus = affiliateFilters.status === 'all' || row.status === affiliateFilters.status;
      const matchPlan = affiliateFilters.plan === 'all' || plan === affiliateFilters.plan.toLowerCase();
      const matchEmail = !affiliateFilters.userEmail || email.toLowerCase().includes(affiliateFilters.userEmail.toLowerCase());
      const matchText = !affiliateFilters.query || text.includes(affiliateFilters.query.toLowerCase());
      const matchFrom = fromTime === null || dateMs >= fromTime;
      const matchTo = toTime === null || dateMs <= toTime;
      return matchInfluencer && matchCode && matchStatus && matchPlan && matchEmail && matchText && matchFrom && matchTo;
    });

    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (affiliateFilters.sort) {
        case 'oldest':
          return a.created_at.localeCompare(b.created_at);
        case 'commission_desc':
          return b.commission_amount - a.commission_amount;
        case 'commission_asc':
          return a.commission_amount - b.commission_amount;
        case 'gross_desc':
          return b.gross_amount - a.gross_amount;
        case 'gross_asc':
          return a.gross_amount - b.gross_amount;
        case 'recent':
        default:
          return b.created_at.localeCompare(a.created_at);
      }
    });

    return sorted;
  }, [affiliateCommissions, affiliateFilters, userEmailById]);

  const commissionSummary = useMemo(() => {
    const grouped = new Map<string, {
      code: string;
      influencer: string;
      conversions: number;
      gross: number;
      totalCommission: number;
      pending: number;
      paid: number;
      commissionPct: number;
      active: boolean;
    }>();

    commissionRows.forEach((row) => {
      const key = `${row.referral_code}::${row.influencer_name}`;
      const existing = grouped.get(key);
      const referralStatus = referrals.find((ref) => ref.code === row.referral_code)?.active ?? false;
      if (!existing) {
        grouped.set(key, {
          code: row.referral_code,
          influencer: row.influencer_name,
          conversions: 1,
          gross: row.gross_amount,
          totalCommission: row.commission_amount,
          pending: row.status === 'pending' ? row.commission_amount : 0,
          paid: row.status === 'paid' ? row.commission_amount : 0,
          commissionPct: row.commission_pct,
          active: referralStatus,
        });
        return;
      }
      existing.conversions += 1;
      existing.gross += row.gross_amount;
      existing.totalCommission += row.commission_amount;
      existing.pending += row.status === 'pending' ? row.commission_amount : 0;
      existing.paid += row.status === 'paid' ? row.commission_amount : 0;
      existing.commissionPct = row.commission_pct || existing.commissionPct;
      existing.active = referralStatus;
    });

    return Array.from(grouped.entries()).map(([key, value]) => ({ key, ...value }));
  }, [commissionRows, referrals]);

  const selectedInfluencerRows = useMemo(() => {
    if (!selectedInfluencerKey) return [];
    const [codeValue, influencerValue] = selectedInfluencerKey.split('::');
    return commissionRows.filter((row) => row.referral_code === codeValue && row.influencer_name === influencerValue);
  }, [commissionRows, selectedInfluencerKey]);

  const queueByStatus = useMemo(
    () => ({
      pending: commissionRows.filter((row) => row.status === 'pending'),
      paid: commissionRows.filter((row) => row.status === 'paid'),
      cancelled: commissionRows.filter((row) => row.status === 'cancelled'),
    }),
    [commissionRows],
  );

  const destroy = useCallback(async (message: string, action: () => Promise<void>) => {
    if (!window.confirm(message)) return;
    await action();
  }, []);

  const handleRefresh = useCallback(() => {
    loadAll();
  }, [loadAll]);

  const handleLogout = useCallback(async () => {
    await adminApi.logout();
    router.push('/admin/login');
  }, [router]);

  const toggleSelectedId = useCallback((id: number) => {
    setSelectedIds((curr) => (curr.includes(id) ? curr.filter((entry) => entry !== id) : [...curr, id]));
  }, []);

  const markPaid = useCallback(async () => {
    if (selectedIds.length === 0) return;
    if (!payoutReference.trim()) {
      window.alert('Informe a referência do payout para continuar.');
      return;
    }
    await actions.markAffiliateCommissionsPaid({ ids: selectedIds, payout_reference: payoutReference.trim(), notes: payoutNotes.trim() || undefined });
    setSelectedIds([]);
    setPayoutReference('');
    setPayoutNotes('');
  }, [actions, payoutNotes, payoutReference, selectedIds]);

  const cancelPending = useCallback(async () => {
    if (selectedIds.length === 0) return;
    await destroy('Deseja cancelar as comissões pendentes selecionadas?', async () => {
      await actions.cancelAffiliateCommissions({ ids: selectedIds, notes: payoutNotes.trim() || undefined });
      setSelectedIds([]);
      setPayoutNotes('');
    });
  }, [actions, destroy, payoutNotes, selectedIds]);

  return (
    <main className="adm-page">
      <style>{`
        .adm-page{min-height:100vh;background:#070a0b;color:#edf4f1;padding:24px;font-family:Inter,sans-serif;overflow-x:hidden}
        .adm-shell{max-width:1340px;margin:0 auto;display:grid;gap:16px}
        .adm-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px;background:linear-gradient(180deg,rgba(24,34,32,.85),rgba(12,16,16,.95));border:1px solid #273430;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.2)}
        .adm-title{font-size:28px;font-weight:900;margin:0}
        .adm-subtitle{color:#93a59e;font-size:13px;margin-top:4px}
        .adm-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
        .adm-tabs{display:flex;gap:8px;flex-wrap:wrap;padding:4px}
        .adm-tab{background:#121a18;border:1px solid #24312d;color:#8ea097;padding:10px 14px;border-radius:10px;cursor:pointer;font-weight:700}
        .adm-tab.on{border-color:#00e676;color:#00e676;background:rgba(0,230,118,.1)}
        .adm-card{background:#0f1514;border:1px solid #202b28;border-radius:12px;padding:16px;box-shadow:0 6px 18px rgba(0,0,0,.16)}
        .adm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
        .adm-kpi-main{font-size:36px;font-weight:900;line-height:1.1;margin-top:6px}
        .adm-kpi{font-size:26px;font-weight:800;margin-top:6px}
        .adm-muted{color:#8ea097;font-size:12px}
        .adm-input,.adm-select,.adm-textarea{background:#151d1b;border:1px solid #2a3833;color:#eff5f2;padding:10px 12px;min-width:180px;border-radius:10px}
        .adm-textarea{min-height:74px}
        .adm-btn{background:#00e676;color:#001108;border:none;padding:10px 12px;font-weight:700;cursor:pointer;min-height:40px;border-radius:10px}
        .adm-btn.alt{background:transparent;border:1px solid #32413c;color:#9cb0a7}
        .adm-btn.danger{background:transparent;border:1px solid #9b3131;color:#ff7676}
        .adm-btn.info{background:transparent;border:1px solid #2f6cd9;color:#8cb7ff}
        .adm-table{display:grid;gap:8px}
        .adm-user{display:grid;grid-template-columns:minmax(0,1.3fr) auto auto auto auto;gap:8px;align-items:center;background:#121917;border:1px solid #1f2a27;border-radius:10px;padding:10px}
        .adm-badge{font-size:11px;font-weight:700;padding:4px 8px;border-radius:999px}
        .adm-badge.free{background:#1a1f1d;color:#a7b6af;border:1px solid #2b3531}
        .adm-badge.paid{background:rgba(0,230,118,.12);color:#00e676;border:1px solid rgba(0,230,118,.35)}
        .adm-badge.admin{background:rgba(49,164,255,.15);color:#7dc3ff;border:1px solid rgba(49,164,255,.45)}
        .adm-badge.pending{background:rgba(255,186,8,.12);color:#ffca53;border:1px solid rgba(255,186,8,.4)}
        .adm-badge.cancelled{background:rgba(255,102,102,.15);color:#ff9b9b;border:1px solid rgba(255,102,102,.35)}
        .adm-feedback{padding:10px 12px;font-size:13px;border:1px solid;border-radius:10px}
        .adm-feedback.ok{border-color:#1b7f47;background:rgba(0,230,118,.1);color:#82e8b3}
        .adm-feedback.err{border-color:#913939;background:rgba(255,77,77,.1);color:#ff9c9c}
        .adm-log{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #1d2824;padding:10px 0;font-size:13px}
        .adm-log:last-child{border-bottom:none}
        .adm-skeleton{background:linear-gradient(90deg,#17201d,#23302c,#17201d);background-size:220px 100%;animation:adm-loading 1.2s infinite ease-in-out;border-radius:8px}
        .adm-skeleton-label{height:14px;width:52%;margin-bottom:10px}
        .adm-skeleton-value{height:34px;width:75%}
        .adm-section-title{font-weight:800;font-size:20px;letter-spacing:.02em;margin:0}
        .adm-section-subtitle{font-size:13px;color:#8ea097;margin-top:4px}
        .adm-two-col{display:grid;grid-template-columns:1.2fr 1fr;gap:12px}
        .adm-three-col{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .adm-chip{background:#121716;border:1px solid #2a3531;color:#8ea097;padding:8px 10px;font-size:12px;font-weight:700;cursor:pointer;border-radius:999px}
        .adm-chip.on{border-color:#00e676;color:#00e676;background:rgba(0,230,118,.12)}
        .adm-table-scroll{overflow:auto;border:1px solid #22302b;border-radius:10px}
        .adm-data-table{width:100%;border-collapse:collapse;min-width:1024px}
        .adm-data-table th,.adm-data-table td{padding:10px;border-bottom:1px solid #1e2825;text-align:left;font-size:13px;vertical-align:top}
        .adm-data-table th{font-size:12px;color:#8ea097;text-transform:uppercase;letter-spacing:.04em;background:#0f1614}
        @media (max-width: 1024px){.adm-two-col,.adm-three-col{grid-template-columns:1fr}.adm-user{grid-template-columns:1fr}}
        @media (max-width: 720px){.adm-page{padding:14px}.adm-head{padding:12px}.adm-title{font-size:22px}}
        @keyframes adm-loading{0%{background-position:-220px 0}100%{background-position:220px 0}}
      `}</style>

      <div className="adm-shell">
        <header className="adm-head">
          <div>
            <h1 className="adm-title">Painel LinhaCash · Operações SaaS</h1>
            <div className="adm-subtitle">Admin premium com foco em operação, faturamento e gestão de afiliados.</div>
          </div>
          <div className="adm-row">
            <button className="adm-btn alt" onClick={handleRefresh}>Atualizar dados</button>
            <button className="adm-btn alt" onClick={handleLogout}>Sair</button>
          </div>
        </header>

        <div className="adm-tabs">
          {TABS.map((item) => (
            <button key={item.key} className={`adm-tab ${tab === item.key ? 'on' : ''}`} onClick={() => setTab(item.key)}>{item.label}</button>
          ))}
        </div>

        {feedback && <div className={`adm-feedback ${feedback.type === 'success' ? 'ok' : 'err'}`} onClick={actions.clearFeedback}>{feedback.message}</div>}
        {loading && <AdminSkeleton />}

        {!loading && tab === 'overview' && stats && (
          <section className="adm-three-col">
            <div className="adm-card"><div className="adm-muted">Total de usuários</div><div className="adm-kpi-main">{stats.total_users}</div></div>
            <div className="adm-card"><div className="adm-muted">Usuários Pro pagos</div><div className="adm-kpi-main">{stats.pro_paid_users}</div></div>
            <div className="adm-card"><div className="adm-muted">Receita mensal estimada</div><div className="adm-kpi-main">{toMoney(stats.estimated_monthly_revenue_brl)}</div></div>
            <div className="adm-card"><div className="adm-muted">Novos usuários (7 dias)</div><div className="adm-kpi">{stats.new_users_7d}</div></div>
            <div className="adm-card"><div className="adm-muted">Aberturas de jogos (30 dias)</div><div className="adm-kpi">{productInsights?.gameOpens ?? 0}</div></div>
            <div className="adm-card"><div className="adm-muted">Status última sincronização</div><div className="adm-kpi">{operationsInsights?.latestSyncStatus || 'N/A'}</div><div className="adm-muted">{operationsInsights?.syncFreshnessLabel || 'Sem dados'}</div></div>
          </section>
        )}

        {!loading && tab === 'users' && (
          <section className="adm-card">
            <h2 className="adm-section-title">Usuários</h2>
            <p className="adm-section-subtitle">Gestão de acesso e suporte ao cliente.</p>
            <div className="adm-row" style={{ marginBottom: 12 }}>
              <input className="adm-input" placeholder="Buscar por nome ou email" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button className="adm-chip" onClick={() => setPlanFilter('all')}>Todos</button>
              <button className="adm-chip" onClick={() => setPlanFilter('pro_paid')}>Pro pago</button>
              <button className="adm-chip" onClick={() => setPlanFilter('pro_admin')}>Pro admin</button>
              <button className="adm-chip" onClick={() => setPlanFilter('free')}>Grátis</button>
            </div>
            <div className="adm-muted" style={{ marginBottom: 10 }}>{filteredUsers.length} usuário(s) filtrado(s).</div>
            <div className="adm-table">
              {filteredUsers.map((user) => (
                <div key={user.id} className="adm-user">
                  <div><div style={{ fontWeight: 700 }}>{user.name || '—'}</div><div className="adm-muted">{user.email}</div></div>
                  <PlanBadge user={user} />
                  <button className="adm-btn" onClick={() => actions.toggleManualPro(user)}>{user.billing?.isManualPro ? 'Revogar Pro Admin' : 'Conceder Pro Admin'}</button>
                  <button className="adm-btn info" onClick={() => actions.resetPassword(user.email)}>Reset senha</button>
                  <button className="adm-btn danger" onClick={() => destroy('Confirma exclusão permanente deste usuário?', () => actions.deleteUser(user.id))}>Excluir</button>
                </div>
              ))}
              {filteredUsers.length === 0 && <p className="adm-muted">Nenhum usuário encontrado.</p>}
            </div>
          </section>
        )}

        {!loading && tab === 'billing' && stats && (
          <section className="adm-card">
            <h2 className="adm-section-title">Faturamento</h2>
            <p className="adm-section-subtitle">Visão financeira executiva e sinais de churn.</p>
            <div className="adm-three-col" style={{ marginBottom: 12 }}>
              <div className="adm-card"><div className="adm-muted">Usuários Pro totais</div><div className="adm-kpi">{stats.pro_users}</div></div>
              <div className="adm-card"><div className="adm-muted">Pro administradores</div><div className="adm-kpi">{stats.pro_admin_users}</div></div>
              <div className="adm-card"><div className="adm-muted">Usuários grátis</div><div className="adm-kpi">{stats.free_users}</div></div>
            </div>
            <div className="adm-section-title" style={{ fontSize: 16 }}>Cancelamentos recentes</div>
            {(stats.recent_cancellations || []).length === 0 && <p className="adm-muted">Sem cancelamentos recentes.</p>}
            {(stats.recent_cancellations || []).slice(0, 10).map((item) => (
              <div className="adm-log" key={item.id}><span>{item.email || item.id}</span><span className="adm-muted">{toDate(item.cancelled_at)}</span></div>
            ))}
          </section>
        )}

        {!loading && tab === 'affiliates' && (
          <section className="adm-two-col">
            <div className="adm-card">
              <h2 className="adm-section-title">Afiliados e influenciadores</h2>
              <p className="adm-section-subtitle">Resumo por código/influenciador, fila de comissão e gestão de payout.</p>

              <div className="adm-row" style={{ marginBottom: 12 }}>
                <input className="adm-input" placeholder="Influenciador" value={affiliateFilters.influencer} onChange={(e) => setAffiliateFilters((curr) => ({ ...curr, influencer: e.target.value }))} />
                <input className="adm-input" placeholder="Código" value={affiliateFilters.code} onChange={(e) => setAffiliateFilters((curr) => ({ ...curr, code: e.target.value }))} />
                <input className="adm-input" placeholder="E-mail do usuário" value={affiliateFilters.userEmail} onChange={(e) => setAffiliateFilters((curr) => ({ ...curr, userEmail: e.target.value }))} />
                <input className="adm-input" placeholder="Busca textual" value={affiliateFilters.query} onChange={(e) => setAffiliateFilters((curr) => ({ ...curr, query: e.target.value }))} />
              </div>
              <div className="adm-row" style={{ marginBottom: 12 }}>
                <select className="adm-select" value={affiliateFilters.status} onChange={(e) => setAffiliateFilters((curr) => ({ ...curr, status: e.target.value as QueueStatus }))}>
                  <option value="all">Todos status</option>
                  <option value="pending">Pendentes</option>
                  <option value="paid">Pagas</option>
                  <option value="cancelled">Canceladas</option>
                </select>
                <select className="adm-select" value={affiliateFilters.plan} onChange={(e) => setAffiliateFilters((curr) => ({ ...curr, plan: e.target.value }))}>
                  <option value="all">Todos planos</option>
                  <option value="pro">Pro</option>
                  <option value="pro_monthly">Pro mensal</option>
                  <option value="pro_yearly">Pro anual</option>
                </select>
                <input className="adm-input" type="date" value={affiliateFilters.from} onChange={(e) => setAffiliateFilters((curr) => ({ ...curr, from: e.target.value }))} />
                <input className="adm-input" type="date" value={affiliateFilters.to} onChange={(e) => setAffiliateFilters((curr) => ({ ...curr, to: e.target.value }))} />
                <select className="adm-select" value={affiliateFilters.sort} onChange={(e) => setAffiliateFilters((curr) => ({ ...curr, sort: e.target.value as SortMode }))}>
                  <option value="recent">Mais recentes</option>
                  <option value="oldest">Mais antigas</option>
                  <option value="commission_desc">Maior comissão</option>
                  <option value="commission_asc">Menor comissão</option>
                  <option value="gross_desc">Maior receita</option>
                  <option value="gross_asc">Menor receita</option>
                </select>
              </div>
              <div className="adm-row" style={{ marginBottom: 12 }}>
                <button className={`adm-chip ${affiliateFilters.status === 'pending' ? 'on' : ''}`} onClick={() => setAffiliateFilters((curr) => ({ ...curr, status: 'pending' }))}>Fila pendente</button>
                <button className={`adm-chip ${affiliateFilters.status === 'paid' ? 'on' : ''}`} onClick={() => setAffiliateFilters((curr) => ({ ...curr, status: 'paid' }))}>Pagas</button>
                <button className={`adm-chip ${affiliateFilters.status === 'cancelled' ? 'on' : ''}`} onClick={() => setAffiliateFilters((curr) => ({ ...curr, status: 'cancelled' }))}>Canceladas</button>
                <button className={`adm-chip ${affiliateFilters.status === 'all' ? 'on' : ''}`} onClick={() => setAffiliateFilters((curr) => ({ ...curr, status: 'all' }))}>Limpar status</button>
              </div>

              <div className="adm-grid" style={{ marginBottom: 10 }}>
                <div className="adm-card"><div className="adm-muted">Pendentes</div><div className="adm-kpi">{queueByStatus.pending.length}</div></div>
                <div className="adm-card"><div className="adm-muted">Pagas</div><div className="adm-kpi">{queueByStatus.paid.length}</div></div>
                <div className="adm-card"><div className="adm-muted">Canceladas</div><div className="adm-kpi">{queueByStatus.cancelled.length}</div></div>
              </div>

              <div className="adm-table-scroll">
                <table className="adm-data-table">
                  <thead>
                    <tr>
                      <th>Código</th><th>Influenciador</th><th>Comissão %</th><th>Conversões</th><th>Receita bruta</th><th>Comissão total</th><th>Pendente</th><th>Paga</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissionSummary.map((row) => (
                      <tr key={row.key} onClick={() => setSelectedInfluencerKey(row.key)} style={{ cursor: 'pointer' }}>
                        <td>{row.code}</td><td>{row.influencer}</td><td>{row.commissionPct}%</td><td>{row.conversions}</td><td>{toMoney(row.gross)}</td><td>{toMoney(row.totalCommission)}</td><td>{toMoney(row.pending)}</td><td>{toMoney(row.paid)}</td>
                        <td><span className={`adm-badge ${row.active ? 'paid' : 'free'}`}>{row.active ? 'Ativo' : 'Inativo'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {commissionSummary.length === 0 && <p className="adm-muted">Sem resultados para os filtros atuais.</p>}
            </div>

            <div className="adm-card">
              <div className="adm-section-title" style={{ fontSize: 18 }}>Detalhe do influenciador / código</div>
              {selectedInfluencerRows.length === 0 && <p className="adm-muted">Selecione uma linha no resumo para ver conversões e pagamentos.</p>}
              {selectedInfluencerRows.length > 0 && (
                <div className="adm-table-scroll" style={{ marginTop: 10 }}>
                  <table className="adm-data-table" style={{ minWidth: 920 }}>
                    <thead>
                      <tr>
                        <th></th><th>Usuário convertido</th><th>Data do pagamento</th><th>Plano</th><th>Valor pago</th><th>Valor comissão</th><th>Status</th><th>Payout ref.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInfluencerRows.map((item) => (
                        <tr key={item.id}>
                          <td>{item.status === 'pending' ? <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelectedId(item.id)} /> : null}</td>
                          <td>{userEmailById.get(item.user_id) || item.user_id}</td>
                          <td>{toDate(item.paid_at || item.approved_at || item.created_at)}</td>
                          <td>{item.plan}</td>
                          <td>{toMoney(item.gross_amount)}</td>
                          <td>{toMoney(item.commission_amount)}</td>
                          <td><span className={`adm-badge ${item.status === 'pending' ? 'pending' : item.status === 'paid' ? 'paid' : 'cancelled'}`}>{STATUS_LABEL[item.status]}</span></td>
                          <td>{item.payout_reference || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="adm-section-title" style={{ fontSize: 16, marginTop: 14 }}>Ações de payout</div>
              <p className="adm-muted">Selecione comissões pendentes no detalhe e execute ações em lote.</p>
              <div className="adm-row" style={{ marginTop: 8 }}>
                <input className="adm-input" placeholder="Referência do payout (obrigatório para pagar)" value={payoutReference} onChange={(e) => setPayoutReference(e.target.value)} />
              </div>
              <div className="adm-row" style={{ marginTop: 8 }}>
                <textarea className="adm-textarea" placeholder="Observações (opcional)" value={payoutNotes} onChange={(e) => setPayoutNotes(e.target.value)} />
              </div>
              <div className="adm-row" style={{ marginTop: 8 }}>
                <button className="adm-btn" onClick={markPaid}>Marcar selecionadas como pagas</button>
                <button className="adm-btn danger" onClick={cancelPending}>Cancelar pendentes selecionadas</button>
                <span className="adm-muted">{selectedIds.length} item(ns) selecionado(s).</span>
              </div>

              <div className="adm-section-title" style={{ fontSize: 16, marginTop: 16 }}>Gestão de códigos</div>
              <div className="adm-row" style={{ marginTop: 8, marginBottom: 10 }}>
                <input className="adm-input" placeholder="Novo código" value={code} onChange={(e) => setCode(e.target.value)} />
                <input className="adm-input" placeholder="Influenciador" value={influencer} onChange={(e) => setInfluencer(e.target.value)} />
                <button className="adm-btn" onClick={async () => { if (!code || !influencer) return; await actions.createReferral(code, influencer); setCode(''); setInfluencer(''); }}>Criar código</button>
              </div>
              {referrals.map((ref) => (
                <div key={ref.id} className="adm-user" style={{ gridTemplateColumns: '1.2fr auto auto auto', marginBottom: 8 }}>
                  <div><div style={{ fontWeight: 700 }}>{ref.code}</div><div className="adm-muted">{ref.influencer_name} · {ref.uses} usos</div></div>
                  <button className="adm-btn alt" onClick={() => actions.toggleReferral(ref.id, ref.active)}>{ref.active ? 'Pausar' : 'Ativar'}</button>
                  <span className={`adm-badge ${ref.active ? 'paid' : 'free'}`}>{ref.active ? 'ATIVO' : 'INATIVO'}</span>
                  <button className="adm-btn danger" onClick={() => destroy('Deseja apagar este código?', () => actions.deleteReferral(ref.id))}>Excluir</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && tab === 'operations' && (
          <section className="adm-card">
            <h2 className="adm-section-title">Operações</h2>
            <p className="adm-section-subtitle">Saúde da sincronização e histórico operacional.</p>
            <div className="adm-row" style={{ marginBottom: 16 }}>
              <button className="adm-btn" onClick={() => destroy('Executar sincronização agora?', actions.runSync)}>Rodar sync agora</button>
              <span className="adm-muted">Mostrando as 8 sincronizações mais recentes.</span>
            </div>
            {(syncHistory || []).slice(0, 8).map((entry, index) => (
              <div className="adm-log" key={`${entry.created_at}-${index}`}>
                <span>{entry.status} · {entry.games_synced} jogos</span>
                <span className="adm-muted">{toDate(entry.created_at)}</span>
              </div>
            ))}
          </section>
        )}

        {!loading && tab === 'security' && (
          <section className="adm-two-col">
            <div className="adm-card">
              <h2 className="adm-section-title">Segurança e logs críticos</h2>
              <p className="adm-section-subtitle">Eventos de autenticação, cobrança e sistema.</p>
              {(operationsInsights?.recentImportantEvents || []).slice(0, 10).map((event, idx) => (
                <div className="adm-log" key={`${event.event}-${idx}`}>
                  <span>{event.event}</span>
                  <span className="adm-muted">{toDate(event.created_at)}</span>
                </div>
              ))}
              {(operationsInsights?.recentImportantEvents?.length || 0) === 0 && <p className="adm-muted">Sem eventos críticos recentes.</p>}
            </div>
            <div className="adm-card">
              <h2 className="adm-section-title">Logs administrativos</h2>
              {(adminActionInsights?.recentBillingAdminChanges || []).slice(0, 8).map((event, idx) => (
                <div className="adm-log" key={`bill-${idx}`}><span>{event.event}</span><span className="adm-muted">{toDate(event.created_at)}</span></div>
              ))}
              {(adminActionInsights?.recentResetsDeletions || []).slice(0, 8).map((event, idx) => (
                <div className="adm-log" key={`reset-${idx}`}><span>{event.event}</span><span className="adm-muted">{toDate(event.created_at)}</span></div>
              ))}
              {(adminActionInsights?.recentBillingAdminChanges?.length || 0) + (adminActionInsights?.recentResetsDeletions?.length || 0) === 0 && (
                <p className="adm-muted">Sem alterações administrativas recentes.</p>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
