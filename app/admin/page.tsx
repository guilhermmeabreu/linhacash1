'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminData } from './_hooks/use-admin-data';
import { adminApi, Profile } from './_lib/admin-api';

type AdminTab = 'dashboard' | 'users' | 'referrals' | 'sync';
const TABS: Array<{ key: AdminTab; label: string }> = [
  { key: 'dashboard', label: 'Painel' },
  { key: 'users', label: 'Usuários' },
  { key: 'referrals', label: 'Indicações' },
  { key: 'sync', label: 'Sincronização' },
];

const brl = (value: number | undefined) => `R$ ${(value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PlanBadge = memo(function PlanBadge({ user }: { user: Profile }) {
  if (user.billing?.isManualPro) return <span className="adm-badge admin">PRO ADMIN</span>;
  if (user.billing?.isPaidPro) return <span className="adm-badge paid">PRO PAGO</span>;
  return <span className="adm-badge free">GRÁTIS</span>;
});

function AdminSkeleton() {
  return (
    <section className="adm-grid">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="adm-card">
          <div className="adm-skeleton adm-skeleton-label" />
          <div className="adm-skeleton adm-skeleton-value" />
        </div>
      ))}
    </section>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { stats, users, referrals, referralUses, commissions, syncHistory, productInsights, operationsInsights, adminActionInsights, loading, syncRunning, feedback, loadAll, actions } = useAdminData();
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'pro_paid' | 'pro_admin' | 'free'>('all');
  const [code, setCode] = useState('');
  const [influencer, setInfluencer] = useState('');
  const [dashboardFocus, setDashboardFocus] = useState<'all' | 'growth' | 'product' | 'operations' | 'activity'>('all');
  const [showSecondary, setShowSecondary] = useState(false);
  const [commissionFilter, setCommissionFilter] = useState<'all' | 'pending' | 'earned' | 'paid'>('all');
  const [payoutNoteDraft, setPayoutNoteDraft] = useState<Record<number, string>>({});

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

  const referralUsesByCode = useMemo(() => {
    const grouped = new Map<string, string[]>();
    referralUses.forEach((use) => {
      const list = grouped.get(use.code) || [];
      if (list.length < 5) {
        list.push(use.profiles?.email || use.user_id);
      }
      grouped.set(use.code, list);
    });
    return grouped;
  }, [referralUses]);

  const usersById = useMemo(() => {
    const map = new Map<string, Profile>();
    users.forEach((user) => map.set(user.id, user));
    return map;
  }, [users]);

  const commissionsByPaymentId = useMemo(() => {
    const map = new Map<string, { status: string; amount: number; paidAt: string | null }>();
    commissions.forEach((item) => {
      if (item.payment_id) {
        map.set(item.payment_id, { status: item.commission_status, amount: Number(item.commission_amount || 0), paidAt: item.paid_at });
      }
    });
    return map;
  }, [commissions]);

  const referralUsageRows = useMemo(() => {
    return referralUses.map((use) => {
      const user = usersById.get(use.user_id);
      const billing = user?.billing;
      const isPaidPro = Boolean(billing?.isPaidPro);
      const isManualPro = Boolean(billing?.isManualPro);
      const proTypeLabel = isPaidPro ? 'Pro pago' : isManualPro ? 'Pro admin' : 'Sem Pro pago';
      const paymentStatusLabel = isPaidPro ? 'Pagamento aprovado' : use.payment_id ? 'Pagamento não confirmado' : 'Sem pagamento';
      const linkedCommission = use.payment_id ? commissionsByPaymentId.get(use.payment_id) : null;
      const commissionStatusLabel = linkedCommission ? linkedCommission.status : 'sem comissão';

      return {
        ...use,
        userEmail: use.profiles?.email || user?.email || use.user_id,
        userName: use.profiles?.name || user?.name || 'Usuário',
        isPaidPro,
        isManualPro,
        proTypeLabel,
        paymentStatusLabel,
        commissionStatusLabel,
        commissionAmount: linkedCommission?.amount || 0,
      };
    });
  }, [commissionsByPaymentId, referralUses, usersById]);

  const paidConversionsByCode = useMemo(() => {
    const map = new Map<string, number>();
    referralUsageRows.forEach((use) => {
      if (!use.isPaidPro) return;
      map.set(use.code, (map.get(use.code) || 0) + 1);
    });
    return map;
  }, [referralUsageRows]);

  const commissionByCode = useMemo(() => {
    return referrals.map((ref) => {
      const paidConversions = paidConversionsByCode.get(ref.code) || 0;
      return {
        id: ref.id,
        code: ref.code,
        influencerName: ref.influencer_name,
        commissionPct: ref.commission_pct || 0,
        paidConversions,
        status: paidConversions > 0 ? 'Pronto para repasse' : 'Sem conversões pagas',
      };
    });
  }, [paidConversionsByCode, referrals]);

  const commissionSummaryByCode = useMemo(() => {
    const grouped = new Map<string, { earned: number; paid: number; pending: number; latest: string | null }>();
    commissions.forEach((item) => {
      const current = grouped.get(item.code) || { earned: 0, paid: 0, pending: 0, latest: null };
      const amount = Number(item.commission_amount || 0);
      if (item.commission_status === 'paid') {
        current.paid += amount;
      } else if (item.commission_status === 'earned') {
        current.earned += amount;
      } else {
        current.pending += amount;
      }
      if (!current.latest || new Date(item.created_at).getTime() > new Date(current.latest).getTime()) {
        current.latest = item.created_at;
      }
      grouped.set(item.code, current);
    });
    return grouped;
  }, [commissions]);

  const filteredCommissions = useMemo(() => {
    if (commissionFilter === 'all') return commissions;
    return commissions.filter((item) => item.commission_status === commissionFilter);
  }, [commissions, commissionFilter]);

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

  return (
    <main className="adm-page">
      <style>{`
        .adm-page{min-height:100vh;background:radial-gradient(circle at top right,#133126 0%,#080b0a 46%,#050606 100%);color:#ecf1ee;padding:24px 20px 36px;font-family:Inter,sans-serif;overflow-x:hidden}
        .adm-shell{max-width:1260px;margin:0 auto;display:grid;gap:16px}
        .adm-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:16px;border:1px solid #1f2a25;border-radius:16px;background:linear-gradient(140deg,rgba(14,26,22,.95),rgba(9,14,12,.92))}
        .adm-title{font-size:24px;font-weight:800;line-height:1.1;margin:0}
        .adm-title em{color:#00e676;font-style:normal}
        .adm-subtitle{margin-top:8px;color:#8ea097;font-size:13px;line-height:1.45}
        .adm-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
        .adm-tabs{display:flex;gap:8px;flex-wrap:wrap;background:#0f1412;border:1px solid #1f2a25;border-radius:14px;padding:8px}
        .adm-tab{background:transparent;border:1px solid #26322d;color:#8ea097;padding:10px 14px;cursor:pointer;font-weight:600;font-size:13px;border-radius:10px;transition:.15s ease}
        .adm-tab.on{border-color:#00e676;color:#00e676;background:rgba(0,230,118,.12);box-shadow:0 0 0 1px rgba(0,230,118,.15) inset}
        .adm-card{background:linear-gradient(180deg,#101715 0%,#0d1110 100%);border:1px solid #1f2825;padding:18px;border-radius:14px;display:grid;gap:12px;box-shadow:0 18px 36px rgba(0,0,0,.2)}
        .adm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
        .adm-kpi{font-size:28px;font-weight:800;margin-top:8px}
        .adm-kpi-sm{font-size:22px;font-weight:800;margin-top:8px}
        .adm-kpi-main{font-size:36px;font-weight:900;line-height:1.1;margin-top:10px}
        .adm-muted{color:#8ea097;font-size:13px}
        .adm-input{background:#151b19;border:1px solid #2a3531;color:#eff5f2;padding:10px 12px;min-width:220px;min-height:44px;border-radius:10px}
        .adm-btn{background:#00e676;color:#001108;border:none;padding:10px 13px;font-weight:700;cursor:pointer;min-height:44px;font-size:13px;line-height:1.25;border-radius:10px;transition:.15s ease}
        .adm-btn.alt{background:transparent;border:1px solid #32413c;color:#9cb0a7}
        .adm-btn.danger{background:transparent;border:1px solid #9b3131;color:#ff7676}
        .adm-btn.info{background:transparent;border:1px solid #2f6cd9;color:#8cb7ff}
        .adm-btn:hover{filter:brightness(1.05)}
        .adm-table{display:grid;gap:8px}
        .adm-user{display:grid;grid-template-columns:minmax(0,1.45fr) repeat(4,minmax(120px,auto));gap:8px;align-items:center;background:#121715;border:1px solid #1d2824;padding:12px;border-radius:12px}
        .adm-badge{font-size:11px;font-weight:700;padding:4px 8px;border-radius:999px;width:max-content}
        .adm-badge.free{background:#1a1f1d;color:#a7b6af;border:1px solid #2b3531}
        .adm-badge.paid{background:rgba(0,230,118,.12);color:#00e676;border:1px solid rgba(0,230,118,.35)}
        .adm-badge.admin{background:rgba(49,164,255,.15);color:#7dc3ff;border:1px solid rgba(49,164,255,.45)}
        .adm-feedback{padding:10px 12px;font-size:13px;border:1px solid;border-radius:10px}
        .adm-feedback.ok{border-color:#1b7f47;background:rgba(0,230,118,.1);color:#82e8b3}
        .adm-feedback.err{border-color:#913939;background:rgba(255,77,77,.1);color:#ff9c9c}
        .adm-log{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #1d2824;padding:10px 0;font-size:13px}
        .adm-log:last-child{border-bottom:none}
        .adm-skeleton{background:linear-gradient(90deg,#17201d,#23302c,#17201d);background-size:220px 100%;animation:adm-loading 1.2s infinite ease-in-out;border-radius:8px}
        .adm-skeleton-label{height:14px;width:52%;margin-bottom:10px}
        .adm-skeleton-value{height:34px;width:75%}
        .adm-section{display:grid;gap:10px}
        .adm-section-title{font-weight:900;font-size:18px;letter-spacing:.02em;line-height:1.25;margin:4px 0}
        .adm-section-block{background:linear-gradient(180deg,#0f1513 0%,#0d1210 100%);border:1px solid #24322c;padding:18px;display:grid;gap:14px;border-radius:14px}
        .adm-main-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .adm-main-kpi{background:linear-gradient(180deg,#111b17 0%,#0d1512 100%);border:1px solid #2b463b;padding:18px;border-radius:14px}
        .adm-main-kpi .adm-muted{font-size:12px;text-transform:uppercase;letter-spacing:.04em}
        .adm-secondary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .adm-pill{display:flex;justify-content:space-between;gap:12px;background:#111816;border:1px solid #26352e;padding:12px 14px;font-size:13px;border-radius:12px}
        .adm-toolbar{display:flex;gap:8px;flex-wrap:wrap}
        .adm-chip{background:#121716;border:1px solid #2a3531;color:#8ea097;padding:8px 10px;font-size:12px;font-weight:700;cursor:pointer;border-radius:999px}
        .adm-chip.on{border-color:#00e676;color:#00e676;background:rgba(0,230,118,.12)}
        .adm-summary{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}
        .adm-two-col{display:grid;grid-template-columns:1.2fr 1fr;gap:12px}
        .adm-three-col{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .adm-list{display:grid;gap:10px}
        .adm-list-row{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px;padding:13px;background:#121715;border:1px solid #1d2824;border-radius:12px}
        .adm-list-label{font-size:11px;letter-spacing:.03em;text-transform:uppercase;color:#7f958b;margin-bottom:4px}
        .adm-list-value{font-size:13px;word-break:break-word}
        .adm-scroll{overflow-x:auto}
        .adm-ref-grid{display:grid;grid-template-columns:1.4fr auto auto auto;gap:8px;align-items:center;background:#101715;border:1px solid #1e2925;padding:12px;border-radius:12px}
        .adm-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
        .adm-strip-item{background:linear-gradient(180deg,#11201a 0%,#0e1714 100%);border:1px solid #284238;padding:12px 14px;border-radius:12px}
        .adm-strip-label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#7e958a}
        .adm-strip-value{font-size:21px;font-weight:900;margin-top:8px}
        .adm-grid-4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
        .adm-kpi-card{background:#111816;border:1px solid #26382f;padding:14px;border-radius:12px;display:grid;gap:8px}
        .adm-kpi-card strong{font-size:20px;line-height:1.1}
        .adm-kpi-card .adm-muted{font-size:12px}
        .adm-status{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
        .adm-status.good{color:#00e676;background:rgba(0,230,118,.15);border:1px solid rgba(0,230,118,.42)}
        .adm-status.warn{color:#ffd166;background:rgba(255,209,102,.14);border:1px solid rgba(255,209,102,.42)}
        .adm-status.bad{color:#ff7b7b;background:rgba(255,123,123,.14);border:1px solid rgba(255,123,123,.45)}
        .adm-status.neutral{color:#9db2a8;background:#121816;border:1px solid #2a3a33}
        @media (max-width: 980px){.adm-two-col,.adm-three-col,.adm-main-kpis,.adm-secondary,.adm-strip,.adm-grid-4{grid-template-columns:1fr}}
        @media (max-width: 1024px){
          .adm-user{grid-template-columns:minmax(0,1fr) repeat(2,minmax(130px,1fr))}
          .adm-user .adm-badge{justify-self:start}
          .adm-ref-grid{grid-template-columns:minmax(0,1fr) repeat(2,minmax(130px,1fr))}
        }
        @media (max-width: 860px){
          .adm-page{padding:16px 14px 30px}
          .adm-shell{gap:14px}
          .adm-head{flex-direction:column;align-items:flex-start}
          .adm-row{width:100%}
          .adm-row .adm-btn,.adm-row .adm-input{flex:1 1 180px}
          .adm-tabs{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
          .adm-tab{white-space:nowrap}
          .adm-user{grid-template-columns:1fr}
          .adm-user > *{min-width:0}
          .adm-user .adm-btn{width:100%}
          .adm-ref-grid{grid-template-columns:1fr}
          .adm-ref-grid .adm-btn{width:100%}
          .adm-list-row{grid-template-columns:repeat(2,minmax(0,1fr))}
          .adm-log{flex-direction:column;align-items:flex-start}
        }
        @media (max-width: 640px){
          .adm-title{font-size:20px}
          .adm-card,.adm-section-block,.adm-main-kpi{padding:12px}
          .adm-kpi-main{font-size:30px}
          .adm-input{min-width:0;width:100%}
          .adm-row .adm-btn{width:100%}
          .adm-pill{flex-direction:column;align-items:flex-start}
          .adm-list-row{grid-template-columns:1fr}
        }
        @keyframes adm-loading{0%{background-position:-220px 0}100%{background-position:220px 0}}
      `}</style>
      <div className="adm-shell">
        <header className="adm-head">
          <div><h1 className="adm-title">Linha<em>Cash</em> Admin</h1><p className="adm-subtitle">Operações, crescimento, referrals e sincronização em um painel único.</p></div>
          <div className="adm-row">
            <button className="adm-btn alt" onClick={handleRefresh}>Atualizar</button>
            <button className="adm-btn alt" onClick={handleLogout}>Sair</button>
          </div>
        </header>

        <div className="adm-strip">
          <div className="adm-strip-item"><div className="adm-strip-label">Usuários</div><div className="adm-strip-value">{stats?.total_users ?? '—'}</div></div>
          <div className="adm-strip-item"><div className="adm-strip-label">Pro pago</div><div className="adm-strip-value">{stats?.pro_paid_users ?? '—'}</div></div>
          <div className="adm-strip-item"><div className="adm-strip-label">MRR estimado</div><div className="adm-strip-value">{brl(stats?.estimated_monthly_recurring_revenue_brl)}</div></div>
          <div className="adm-strip-item"><div className="adm-strip-label">Receita líquida</div><div className="adm-strip-value">{brl(stats?.net_revenue_brl)}</div></div>
        </div>

        <div className="adm-tabs">
          {TABS.map((item) => (
            <button key={item.key} className={`adm-tab ${tab === item.key ? 'on' : ''}`} onClick={() => setTab(item.key)}>{item.label}</button>
          ))}
        </div>

        {feedback && <div className={`adm-feedback ${feedback.type === 'success' ? 'ok' : 'err'}`} onClick={actions.clearFeedback}>{feedback.message}</div>}

        {loading && <AdminSkeleton />}

        {!loading && tab === 'dashboard' && stats && (
          <section className="adm-section">
            <div className="adm-toolbar">
              <button className={`adm-chip ${dashboardFocus === 'all' ? 'on' : ''}`} onClick={() => setDashboardFocus('all')}>Tudo</button>
              <button className={`adm-chip ${dashboardFocus === 'growth' ? 'on' : ''}`} onClick={() => setDashboardFocus('growth')}>Crescimento</button>
              <button className={`adm-chip ${dashboardFocus === 'product' ? 'on' : ''}`} onClick={() => setDashboardFocus('product')}>Produto</button>
              <button className={`adm-chip ${dashboardFocus === 'operations' ? 'on' : ''}`} onClick={() => setDashboardFocus('operations')}>Operação</button>
              <button className={`adm-chip ${dashboardFocus === 'activity' ? 'on' : ''}`} onClick={() => setDashboardFocus('activity')}>Atividade</button>
              <button className={`adm-chip ${showSecondary ? 'on' : ''}`} onClick={() => setShowSecondary((value) => !value)}>Detalhes secundários</button>
            </div>

            <div className="adm-section-title">Top KPIs</div>
            <div className="adm-main-kpis">
              <div className="adm-main-kpi"><div className="adm-muted">Total de usuários</div><div className="adm-kpi-main">{stats.total_users}</div></div>
              <div className="adm-main-kpi"><div className="adm-muted">Usuários Pro pagos</div><div className="adm-kpi-main">{stats.pro_paid_users}</div></div>
              <div className="adm-main-kpi"><div className="adm-muted">Receita recorrente mensal (estimada)</div><div className="adm-kpi-main">{brl(stats.estimated_monthly_recurring_revenue_brl)}</div></div>
              <div className="adm-main-kpi"><div className="adm-muted">Receita líquida (estimada)</div><div className="adm-kpi-main">{brl(stats.net_revenue_brl)}</div></div>
            </div>
            <div className="adm-secondary">
              <div className="adm-pill"><span>Usuários grátis</span><strong>{stats.free_users}</strong></div>
              <div className="adm-pill"><span>Usuários Pro admin</span><strong>{stats.pro_admin_users}</strong></div>
              <div className="adm-pill"><span>Plano mensal ativo</span><strong>{stats.paid_monthly_users}</strong></div>
              <div className="adm-pill"><span>Plano anual ativo</span><strong>{stats.paid_annual_users}</strong></div>
              <div className="adm-pill"><span>Plano playoff ativo</span><strong>{stats.paid_playoff_users}</strong></div>
            </div>

            <div className="adm-section-title">Financeiro</div>
            <div className="adm-section-block">
              <div className="adm-grid-4">
                <div className="adm-kpi-card"><span className="adm-muted">Receita bruta</span><strong>{brl(stats.gross_revenue_brl)}</strong></div>
                <div className="adm-kpi-card"><span className="adm-muted">Taxas Stripe (estimadas)</span><strong>{brl(stats.estimated_stripe_fees_brl)}</strong></div>
                <div className="adm-kpi-card"><span className="adm-muted">Comissões de afiliados (estimadas)</span><strong>{brl(stats.estimated_affiliate_commissions_brl)}</strong></div>
                <div className="adm-kpi-card"><span className="adm-muted">Receita líquida</span><strong>{brl(stats.net_revenue_brl)}</strong></div>
              </div>
              <div className="adm-grid-4">
                <div className="adm-kpi-card"><span className="adm-muted">Caixa mensal coletado</span><strong>{brl(stats.monthly_cash_collected_brl)}</strong></div>
                <div className="adm-kpi-card"><span className="adm-muted">Caixa anual coletado</span><strong>{brl(stats.annual_cash_collected_brl)}</strong></div>
                <div className="adm-kpi-card"><span className="adm-muted">Receita playoff</span><strong>{brl(stats.playoff_revenue_brl)}</strong></div>
                <div className="adm-kpi-card"><span className="adm-muted">MRR estimado</span><strong>{brl(stats.estimated_monthly_recurring_revenue_brl)}</strong></div>
              </div>
            </div>

            <div className="adm-section-title">Afiliados e indicações</div>
            <div className="adm-section-block">
              <div className="adm-grid-4">
                <div className="adm-kpi-card"><span className="adm-muted">Conversões pagas</span><strong>{stats.affiliate_paid_conversions}</strong></div>
                <div className="adm-kpi-card"><span className="adm-muted">Comissão pendente</span><strong>{brl(stats.total_affiliate_commission_pending_brl)}</strong></div>
                <div className="adm-kpi-card"><span className="adm-muted">Comissão earned</span><strong>{brl(stats.total_affiliate_commission_earned_brl)}</strong></div>
                <div className="adm-kpi-card"><span className="adm-muted">Comissão paga</span><strong>{brl(stats.total_affiliate_commission_paid_brl)}</strong></div>
              </div>
              <div className="adm-two-col">
                <div>
                  <div className="adm-section-title" style={{ fontSize: 14 }}>Top códigos por conversão</div>
                  {(stats.top_referral_codes_by_conversion || []).map((item) => (
                    <div className="adm-log" key={`conv-${item.code}`}>
                      <span>{item.code}</span>
                      <strong>{item.conversions}</strong>
                    </div>
                  ))}
                  {(stats.top_referral_codes_by_conversion || []).length === 0 && <p className="adm-muted">Sem conversões registradas.</p>}
                </div>
                <div>
                  <div className="adm-section-title" style={{ fontSize: 14 }}>Top códigos por comissão</div>
                  {(stats.top_referral_codes_by_commission_amount || []).map((item) => (
                    <div className="adm-log" key={`amount-${item.code}`}>
                      <span>{item.code}</span>
                      <strong>{brl(item.commission_amount_brl)}</strong>
                    </div>
                  ))}
                  {(stats.top_referral_codes_by_commission_amount || []).length === 0 && <p className="adm-muted">Sem comissões registradas.</p>}
                </div>
              </div>
            </div>

            {(dashboardFocus === 'all' || dashboardFocus === 'growth') && (
            <>
            <div className="adm-section-title">Crescimento</div>
            <div className="adm-section-block">
              <div className="adm-secondary">
                <div className="adm-pill"><span>Novos usuários hoje</span><strong>{stats.new_users_today}</strong></div>
                <div className="adm-pill"><span>Novos usuários em 7 dias</span><strong>{stats.new_users_7d}</strong></div>
                <div className="adm-pill"><span>Novos usuários em 30 dias</span><strong>{stats.new_users_30d}</strong></div>
                <div className="adm-pill"><span>Base total ativa no painel</span><strong>{stats.total_users}</strong></div>
              </div>
            </div>
            </>
            )}

            {(dashboardFocus === 'all' || dashboardFocus === 'product') && (
            <>
            <div className="adm-section-title">Uso do produto</div>
            <div className="adm-section-block">
              <div className="adm-secondary">
                <div className="adm-pill"><span>Aberturas de jogos</span><strong>{productInsights?.gameOpens ?? 0}</strong></div>
                <div className="adm-pill"><span>Aberturas do modal de jogador</span><strong>{productInsights?.playerModalOpens ?? 0}</strong></div>
                <div className="adm-pill"><span>Cliques de upgrade</span><strong>{productInsights?.upgradeClicks ?? 0}</strong></div>
                <div className="adm-pill"><span>Cliques em recurso Pro bloqueado</span><strong>{productInsights?.lockedProFeatureClicks ?? 0}</strong></div>
                {showSecondary && <div className="adm-pill"><span>Total de eventos ({productInsights?.periodDays ?? 30} dias)</span><strong>{productInsights?.totalEvents ?? 0}</strong></div>}
                {showSecondary && <div className="adm-pill"><span>Tabela de eventos</span><strong>{productInsights?.eventsAvailable ? 'Disponível' : 'Dados insuficientes'}</strong></div>}
              </div>
              {showSecondary && <div className="adm-two-col">
                <div>
                  <div className="adm-section-title" style={{ fontSize: 14 }}>Mercados mais usados</div>
                {(productInsights?.mostUsedMarkets?.length || 0) === 0 && <p className="adm-muted">Não há dados de mercado suficientes ainda.</p>}
                {(productInsights?.mostUsedMarkets || []).map((item) => (
                  <div className="adm-log" key={item.market}>
                    <span>{item.market.toUpperCase()}</span>
                    <span>{item.count}</span>
                  </div>
                ))}
                </div>
                <div>
                  <div className="adm-section-title" style={{ fontSize: 14 }}>Resumo recente de eventos</div>
                {(productInsights?.recentEventSummaries?.length || 0) === 0 && <p className="adm-muted">Não há eventos recentes para resumir.</p>}
                {(productInsights?.recentEventSummaries || []).map((item) => (
                  <div className="adm-log" key={item.event_name}>
                    <span>{item.event_name}</span>
                    <span>{item.count}</span>
                  </div>
                ))}
                </div>
              </div>}
            </div>
            </>
            )}

            {(dashboardFocus === 'all' || dashboardFocus === 'operations') && (
            <>
            <div className="adm-section-title">Operação</div>
            <div className="adm-section-block">
              <div className="adm-two-col">
                <div>
                <div className="adm-muted">Status da última sincronização</div>
                <div className="adm-kpi-sm">{operationsInsights?.latestSyncStatus || 'N/A'}</div>
                <p className="adm-muted">{operationsInsights?.latestSyncTimestamp ? new Date(operationsInsights.latestSyncTimestamp).toLocaleString('pt-BR') : 'Sem horário registrado'}</p>
                <span className={`adm-status ${
                  operationsInsights?.syncFreshness === 'fresh'
                    ? 'good'
                    : operationsInsights?.syncFreshness === 'stale'
                      ? 'warn'
                      : operationsInsights?.syncFreshness === 'critical'
                        ? 'bad'
                        : 'neutral'
                }`}>
                  {operationsInsights?.syncFreshnessLabel || 'Sem dados de sincronização'}
                </span>
                </div>
                <div>
                <div className="adm-section-title" style={{ fontSize: 14 }}>Últimas 5 sincronizações</div>
                {(syncHistory || []).slice(0, 5).map((entry, index) => (
                  <div className="adm-log" key={`${entry.created_at}-${index}`}>
                    <span>{entry.status} · {entry.games_synced} jogos</span>
                    <span className="adm-muted">{new Date(entry.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
                </div>
              </div>
              {showSecondary && <div>
                <div className="adm-section-title" style={{ fontSize: 14 }}>Eventos importantes (autenticação, cobrança e sistema)</div>
                {(operationsInsights?.recentImportantEvents?.length || 0) === 0 && <p className="adm-muted">Não há eventos importantes registrados.</p>}
                {(operationsInsights?.recentImportantEvents || []).slice(0, 6).map((event, idx) => (
                  <div className="adm-log" key={`${event.event}-${idx}`}>
                    <span>{event.event}</span>
                    <span className="adm-muted">{new Date(event.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>}
            </div>
            </>
            )}

            {(dashboardFocus === 'all' || dashboardFocus === 'activity') && (
            <>
            <div className="adm-section-title">Atividade recente</div>
            <div className="adm-two-col">
              <div className="adm-section-block">
                <div className="adm-section-title" style={{ fontSize: 14 }}>Cadastros recentes</div>
                {stats.recent_signups.slice(0, 6).map((user) => (
                  <div className="adm-log" key={user.id}>
                    <span>{user.email || user.id}</span>
                    <span className="adm-muted">{new Date(user.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
                <div className="adm-section-title" style={{ fontSize: 14 }}>Ações recentes dos usuários</div>
                {(adminActionInsights?.recentUserActions?.length || 0) === 0 && <p className="adm-muted">Ainda não há ações recentes.</p>}
                {(adminActionInsights?.recentUserActions || []).slice(0, 5).map((event, idx) => (
                  <div className="adm-log" key={`${event.action}-${idx}`}>
                    <span>{event.action} · {event.context}</span>
                    <span className="adm-muted">{new Date(event.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
              <div className="adm-section-block">
                <div className="adm-section-title" style={{ fontSize: 14 }}>Cancelamentos recentes</div>
                {stats.recent_cancellations.length === 0 && <p className="adm-muted">Ainda não há cancelamentos recentes.</p>}
                {stats.recent_cancellations.slice(0, 6).map((item) => (
                  <div className="adm-log" key={item.id}>
                    <span>{item.email || item.id}</span>
                    <span className="adm-muted">{item.cancelled_at ? new Date(item.cancelled_at).toLocaleString('pt-BR') : 'sem data'}</span>
                  </div>
                ))}
                <div className="adm-section-title" style={{ fontSize: 14 }}>Mudanças administrativas e de cobrança</div>
                {(adminActionInsights?.recentBillingAdminChanges || []).slice(0, 5).map((event, idx) => (
                  <div className="adm-log" key={`bill-${event.event}-${idx}`}>
                    <span>{event.event}</span>
                    <span className="adm-muted">{new Date(event.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
                {(adminActionInsights?.recentResetsDeletions || []).slice(0, 5).map((event, idx) => (
                  <div className="adm-log" key={`reset-${event.event}-${idx}`}>
                    <span>{event.event}</span>
                    <span className="adm-muted">{new Date(event.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
                {(adminActionInsights?.recentBillingAdminChanges?.length || 0) + (adminActionInsights?.recentResetsDeletions?.length || 0) === 0 && (
                  <p className="adm-muted">Não há registros de alterações administrativas, redefinições ou deleções.</p>
                )}
              </div>
            </div>
            </>
            )}
          </section>
        )}

        {!loading && tab === 'users' && (
          <section className="adm-card">
            <div className="adm-row" style={{ marginBottom: 12 }}>
              <input className="adm-input" placeholder="Buscar por nome ou email" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button className="adm-btn alt" onClick={() => setPlanFilter('all')}>TODOS</button>
              <button className="adm-btn alt" onClick={() => setPlanFilter('pro_paid')}>PRO PAGO</button>
              <button className="adm-btn alt" onClick={() => setPlanFilter('pro_admin')}>PRO ADMIN</button>
              <button className="adm-btn alt" onClick={() => setPlanFilter('free')}>GRÁTIS</button>
            </div>
            <div className="adm-summary">
              <span className="adm-muted">{filteredUsers.length} usuário(s) filtrado(s)</span>
            </div>
            <div className="adm-table">
              {filteredUsers.map((user) => (
                <div key={user.id} className="adm-user">
                  <div>
                    <div style={{ fontWeight: 700 }}>{user.name || '—'}</div>
                    <div className="adm-muted">{user.email}</div>
                  </div>
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

        {!loading && tab === 'referrals' && (
          <section className="adm-card">
            <div className="adm-section-title">Resumo de afiliados</div>
            <div className="adm-secondary">
              <div className="adm-pill"><span>Conversões afiliadas (pagas)</span><strong>{stats?.affiliate_paid_conversions ?? 0}</strong></div>
              <div className="adm-pill"><span>Comissão pendente</span><strong>R$ {(stats?.total_affiliate_commission_pending_brl ?? 0).toLocaleString('pt-BR')}</strong></div>
              <div className="adm-pill"><span>Comissão earned</span><strong>R$ {(stats?.total_affiliate_commission_earned_brl ?? 0).toLocaleString('pt-BR')}</strong></div>
              <div className="adm-pill"><span>Comissão paga</span><strong>R$ {(stats?.total_affiliate_commission_paid_brl ?? 0).toLocaleString('pt-BR')}</strong></div>
            </div>

            <div className="adm-row" style={{ marginBottom: 16 }}>
              <input className="adm-input" placeholder="Código" value={code} onChange={(e) => setCode(e.target.value)} />
              <input className="adm-input" placeholder="Influenciador" value={influencer} onChange={(e) => setInfluencer(e.target.value)} />
              <button className="adm-btn" onClick={async () => { if (!code || !influencer) return; await actions.createReferral(code, influencer); setCode(''); setInfluencer(''); }}>Criar</button>
            </div>
            <div className="adm-section-title">Códigos de indicação</div>
            <div className="adm-list">
              {referrals.map((ref) => {
                const uses = referralUsesByCode.get(ref.code) || [];
                const paidConversions = paidConversionsByCode.get(ref.code) || 0;
                const summary = commissionSummaryByCode.get(ref.code) || { earned: 0, paid: 0, pending: 0, latest: null };
                return (
                  <div key={ref.id} className="adm-ref-grid">
                    <div>
                      <div style={{ fontWeight: 700 }}>{ref.code}</div>
                      <div className="adm-muted">{ref.influencer_name} · {ref.uses} usos · {paidConversions} conversões pagas · {ref.commission_pct}% comissão</div>
                      <div className="adm-muted">
                        Earned R$ {summary.earned.toLocaleString('pt-BR')} · Pago R$ {summary.paid.toLocaleString('pt-BR')} · Pendente R$ {summary.pending.toLocaleString('pt-BR')}
                      </div>
                      <div className="adm-muted">Últimos usos: {uses.join(' · ') || 'nenhum'}</div>
                    </div>
                    <button className="adm-btn alt" onClick={() => actions.toggleReferral(ref.id, ref.active)}>{ref.active ? 'Pausar' : 'Ativar'}</button>
                    <span className={`adm-badge ${ref.active ? 'paid' : 'free'}`}>{ref.active ? 'ATIVO' : 'INATIVO'}</span>
                    <button className="adm-btn danger" onClick={() => destroy('Deseja apagar este código?', () => actions.deleteReferral(ref.id))}>Excluir</button>
                  </div>
                );
              })}
              {referrals.length === 0 && <p className="adm-muted">Nenhum código cadastrado.</p>}
            </div>

            <div className="adm-section-title" style={{ marginTop: 8 }}>Histórico de uso de códigos</div>
            <div className="adm-scroll">
              <div className="adm-list">
                {referralUsageRows.map((use) => (
                  <div className="adm-list-row" key={use.id}>
                    <div><div className="adm-list-label">Usuário</div><div className="adm-list-value">{use.userName}<br /><span className="adm-muted">{use.userEmail}</span></div></div>
                    <div><div className="adm-list-label">Código</div><div className="adm-list-value">{use.code}</div></div>
                    <div><div className="adm-list-label">Data</div><div className="adm-list-value">{new Date(use.created_at).toLocaleString('pt-BR')}</div></div>
                    <div><div className="adm-list-label">Payment ID</div><div className="adm-list-value">{use.payment_id || '—'}</div></div>
                    <div><div className="adm-list-label">Pagamento</div><div className="adm-list-value">{use.paymentStatusLabel}</div></div>
                    <div><div className="adm-list-label">Tipo de Pro</div><div className="adm-list-value">{use.proTypeLabel}</div></div>
                    <div><div className="adm-list-label">Comissão</div><div className="adm-list-value">{use.isPaidPro ? `${use.commissionStatusLabel} · R$ ${use.commissionAmount.toLocaleString('pt-BR')}` : 'Não elegível'}</div></div>
                  </div>
                ))}
                {referralUsageRows.length === 0 && <p className="adm-muted">Nenhum uso registrado.</p>}
              </div>
            </div>

            <div className="adm-section-title" style={{ marginTop: 8 }}>Visão para repasse de comissão</div>
            <div className="adm-toolbar">
              <button className={`adm-chip ${commissionFilter === 'all' ? 'on' : ''}`} onClick={() => setCommissionFilter('all')}>Todas</button>
              <button className={`adm-chip ${commissionFilter === 'pending' ? 'on' : ''}`} onClick={() => setCommissionFilter('pending')}>Pending</button>
              <button className={`adm-chip ${commissionFilter === 'earned' ? 'on' : ''}`} onClick={() => setCommissionFilter('earned')}>Earned</button>
              <button className={`adm-chip ${commissionFilter === 'paid' ? 'on' : ''}`} onClick={() => setCommissionFilter('paid')}>Paid</button>
            </div>
            <div className="adm-list">
              {commissionByCode.map((item) => (
                <div className="adm-list-row" key={item.id}>
                  <div><div className="adm-list-label">Influenciador</div><div className="adm-list-value">{item.influencerName}</div></div>
                  <div><div className="adm-list-label">Código</div><div className="adm-list-value">{item.code}</div></div>
                  <div><div className="adm-list-label">Conversões pagas</div><div className="adm-list-value">{item.paidConversions}</div></div>
                  <div><div className="adm-list-label">% Comissão</div><div className="adm-list-value">{item.commissionPct}%</div></div>
                  <div style={{ gridColumn: 'span 2' }}><div className="adm-list-label">Status</div><div className="adm-list-value">{item.status}</div></div>
                </div>
              ))}
              {commissionByCode.length === 0 && <p className="adm-muted">Nenhuma informação de comissão disponível.</p>}
            </div>

            <div className="adm-section-title" style={{ marginTop: 8 }}>Gestão de comissões (por conversão)</div>
            <div className="adm-list">
              {filteredCommissions.map((item) => (
                <div className="adm-list-row" key={`commission-${item.id}`}>
                  <div><div className="adm-list-label">Código</div><div className="adm-list-value">{item.code}</div></div>
                  <div><div className="adm-list-label">Payment ID</div><div className="adm-list-value">{item.payment_id || '—'}</div></div>
                  <div><div className="adm-list-label">Valor comissão</div><div className="adm-list-value">R$ {Number(item.commission_amount || 0).toLocaleString('pt-BR')}</div></div>
                  <div><div className="adm-list-label">Status</div><div className="adm-list-value">{item.commission_status}</div></div>
                  <div><div className="adm-list-label">Pago em</div><div className="adm-list-value">{item.paid_at ? new Date(item.paid_at).toLocaleString('pt-BR') : '—'}</div></div>
                  <div>
                    <div className="adm-list-label">Ações</div>
                    <div className="adm-row">
                      {item.commission_status !== 'paid' && (
                        <button
                          className="adm-btn"
                          onClick={() => actions.updateCommissionStatus(item.id, 'paid', payoutNoteDraft[item.id] || '')}
                        >
                          Marcar pago
                        </button>
                      )}
                      {item.commission_status === 'paid' && (
                        <button
                          className="adm-btn alt"
                          onClick={() => actions.updateCommissionStatus(item.id, 'earned', payoutNoteDraft[item.id] || '')}
                        >
                          Voltar p/ earned
                        </button>
                      )}
                      <input
                        className="adm-input"
                        placeholder="Nota do repasse"
                        value={payoutNoteDraft[item.id] || item.payout_note || ''}
                        onChange={(e) => setPayoutNoteDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {filteredCommissions.length === 0 && <p className="adm-muted">Nenhuma comissão encontrada para este filtro.</p>}
            </div>
          </section>
        )}

        {!loading && tab === 'sync' && (
          <section className="adm-card">
            <div className="adm-row" style={{ marginBottom: 16 }}>
              <button className="adm-btn" disabled={syncRunning} onClick={() => destroy('Executar sincronização agora?', actions.runSync)}>
                {syncRunning ? 'Sincronizando...' : 'Rodar sync agora'}
              </button>
              <span className="adm-muted">Mostrando as 5 sincronizações mais recentes.</span>
            </div>
            {(syncHistory || []).slice(0, 5).map((entry, index) => (
              <div className="adm-log" key={`${entry.created_at}-${index}`}>
                <span>{entry.status} · {entry.games_synced} jogos</span>
                <span className="adm-muted">{new Date(entry.created_at).toLocaleString('pt-BR')}</span>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
