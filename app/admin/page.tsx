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
  const { stats, users, referrals, referralUses, syncHistory, productInsights, operationsInsights, adminActionInsights, loading, feedback, loadAll, actions } = useAdminData();
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'pro_paid' | 'pro_admin' | 'free'>('all');
  const [code, setCode] = useState('');
  const [influencer, setInfluencer] = useState('');

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
        .adm-page{min-height:100vh;background:#080909;color:#ecf1ee;padding:24px;font-family:Inter,sans-serif;overflow-x:hidden}
        .adm-shell{max-width:1240px;margin:0 auto;display:grid;gap:18px}
        .adm-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-bottom:8px;border-bottom:1px solid #1e2422}
        .adm-title{font-size:24px;font-weight:800}
        .adm-title em{color:#00e676;font-style:normal}
        .adm-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
        .adm-tabs{display:flex;gap:8px;flex-wrap:wrap}
        .adm-tab{background:#121716;border:1px solid #252e2b;color:#8ea097;padding:10px 14px;cursor:pointer;font-weight:600}
        .adm-tab.on{border-color:#00e676;color:#00e676;background:rgba(0,230,118,.1)}
        .adm-card{background:#0f1312;border:1px solid #1f2825;padding:16px}
        .adm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
        .adm-kpi{font-size:28px;font-weight:800;margin-top:8px}
        .adm-kpi-sm{font-size:22px;font-weight:800;margin-top:8px}
        .adm-kpi-main{font-size:36px;font-weight:900;line-height:1.1;margin-top:10px}
        .adm-muted{color:#8ea097;font-size:13px}
        .adm-input{background:#151b19;border:1px solid #2a3531;color:#eff5f2;padding:10px 12px;min-width:220px}
        .adm-btn{background:#00e676;color:#001108;border:none;padding:10px 12px;font-weight:700;cursor:pointer;min-height:40px}
        .adm-btn.alt{background:transparent;border:1px solid #32413c;color:#9cb0a7}
        .adm-btn.danger{background:transparent;border:1px solid #9b3131;color:#ff7676}
        .adm-btn.info{background:transparent;border:1px solid #2f6cd9;color:#8cb7ff}
        .adm-table{display:grid;gap:8px}
        .adm-user{display:grid;grid-template-columns:minmax(0,1.4fr) auto auto auto auto;gap:8px;align-items:center;background:#121715;border:1px solid #1d2824;padding:10px}
        .adm-badge{font-size:11px;font-weight:700;padding:4px 8px}
        .adm-badge.free{background:#1a1f1d;color:#a7b6af;border:1px solid #2b3531}
        .adm-badge.paid{background:rgba(0,230,118,.12);color:#00e676;border:1px solid rgba(0,230,118,.35)}
        .adm-badge.admin{background:rgba(49,164,255,.15);color:#7dc3ff;border:1px solid rgba(49,164,255,.45)}
        .adm-feedback{padding:10px 12px;font-size:13px;border:1px solid}
        .adm-feedback.ok{border-color:#1b7f47;background:rgba(0,230,118,.1);color:#82e8b3}
        .adm-feedback.err{border-color:#913939;background:rgba(255,77,77,.1);color:#ff9c9c}
        .adm-log{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #1d2824;padding:10px 0;font-size:13px}
        .adm-log:last-child{border-bottom:none}
        .adm-skeleton{background:linear-gradient(90deg,#17201d,#23302c,#17201d);background-size:220px 100%;animation:adm-loading 1.2s infinite ease-in-out}
        .adm-skeleton-label{height:14px;width:52%;margin-bottom:10px}
        .adm-skeleton-value{height:34px;width:75%}
        .adm-section{display:grid;gap:10px}
        .adm-section-title{font-weight:800;font-size:16px;letter-spacing:.02em}
        .adm-section-block{background:#0f1312;border:1px solid #1f2825;padding:16px;display:grid;gap:12px}
        .adm-main-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .adm-main-kpi{background:#101715;border:1px solid #274036;padding:14px}
        .adm-main-kpi .adm-muted{font-size:12px;text-transform:uppercase;letter-spacing:.04em}
        .adm-secondary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .adm-pill{display:flex;justify-content:space-between;gap:12px;background:#111614;border:1px solid #1e2a25;padding:10px 12px;font-size:13px}
        .adm-two-col{display:grid;grid-template-columns:1.2fr 1fr;gap:12px}
        .adm-three-col{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        @media (max-width: 980px){.adm-two-col,.adm-three-col,.adm-main-kpis,.adm-secondary{grid-template-columns:1fr}}
        @media (max-width: 860px){
          .adm-page{padding:16px}
          .adm-shell{gap:14px}
          .adm-head{flex-direction:column;align-items:flex-start}
          .adm-row{width:100%}
          .adm-row .adm-btn,.adm-row .adm-input{flex:1 1 180px}
          .adm-tabs{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px}
          .adm-tab{white-space:nowrap}
          .adm-user{grid-template-columns:1fr}
          .adm-user > *{min-width:0}
          .adm-log{flex-direction:column;align-items:flex-start}
        }
        @media (max-width: 640px){
          .adm-title{font-size:20px}
          .adm-card,.adm-section-block,.adm-main-kpi{padding:12px}
          .adm-kpi-main{font-size:30px}
          .adm-input{min-width:0;width:100%}
          .adm-row .adm-btn{width:100%}
          .adm-pill{flex-direction:column;align-items:flex-start}
          .adm-badge{width:max-content}
        }
        @keyframes adm-loading{0%{background-position:-220px 0}100%{background-position:220px 0}}
      `}</style>
      <div className="adm-shell">
        <header className="adm-head">
          <h1 className="adm-title">Linha<em>Cash</em> Admin</h1>
          <div className="adm-row">
            <button className="adm-btn alt" onClick={handleRefresh}>Atualizar</button>
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

        {!loading && tab === 'dashboard' && stats && (
          <section className="adm-section">
            <div className="adm-section-title">Visão geral</div>
            <div className="adm-main-kpis">
              <div className="adm-main-kpi"><div className="adm-muted">Total de usuários</div><div className="adm-kpi-main">{stats.total_users}</div></div>
              <div className="adm-main-kpi"><div className="adm-muted">Usuários Pro pagos</div><div className="adm-kpi-main">{stats.pro_paid_users}</div></div>
              <div className="adm-main-kpi"><div className="adm-muted">Receita mensal estimada</div><div className="adm-kpi-main">R$ {stats.estimated_monthly_revenue_brl.toLocaleString('pt-BR')}</div></div>
            </div>
            <div className="adm-secondary">
              <div className="adm-pill"><span>Usuários grátis</span><strong>{stats.free_users}</strong></div>
              <div className="adm-pill"><span>Usuários Pro admin</span><strong>{stats.pro_admin_users}</strong></div>
            </div>

            <div className="adm-section-title">Crescimento</div>
            <div className="adm-section-block">
              <div className="adm-secondary">
                <div className="adm-pill"><span>Novos usuários hoje</span><strong>{stats.new_users_today}</strong></div>
                <div className="adm-pill"><span>Novos usuários em 7 dias</span><strong>{stats.new_users_7d}</strong></div>
                <div className="adm-pill"><span>Novos usuários em 30 dias</span><strong>{stats.new_users_30d}</strong></div>
                <div className="adm-pill"><span>Base total ativa no painel</span><strong>{stats.total_users}</strong></div>
              </div>
            </div>

            <div className="adm-section-title">Uso do produto</div>
            <div className="adm-section-block">
              <div className="adm-secondary">
                <div className="adm-pill"><span>Aberturas de jogos</span><strong>{productInsights?.gameOpens ?? 0}</strong></div>
                <div className="adm-pill"><span>Aberturas do modal de jogador</span><strong>{productInsights?.playerModalOpens ?? 0}</strong></div>
                <div className="adm-pill"><span>Cliques de upgrade</span><strong>{productInsights?.upgradeClicks ?? 0}</strong></div>
                <div className="adm-pill"><span>Cliques em recurso Pro bloqueado</span><strong>{productInsights?.lockedProFeatureClicks ?? 0}</strong></div>
                <div className="adm-pill"><span>Total de eventos ({productInsights?.periodDays ?? 30} dias)</span><strong>{productInsights?.totalEvents ?? 0}</strong></div>
                <div className="adm-pill"><span>Tabela de eventos</span><strong>{productInsights?.eventsAvailable ? 'Disponível' : 'Dados insuficientes'}</strong></div>
              </div>
              <div className="adm-two-col">
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
              </div>
            </div>

            <div className="adm-section-title">Operação</div>
            <div className="adm-section-block">
              <div className="adm-two-col">
                <div>
                <div className="adm-muted">Status da última sincronização</div>
                <div className="adm-kpi-sm">{operationsInsights?.latestSyncStatus || 'N/A'}</div>
                <p className="adm-muted">{operationsInsights?.latestSyncTimestamp ? new Date(operationsInsights.latestSyncTimestamp).toLocaleString('pt-BR') : 'Sem horário registrado'}</p>
                <p className="adm-muted">{operationsInsights?.syncFreshnessLabel || 'Sem dados de sincronização'}</p>
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
              <div>
                <div className="adm-section-title" style={{ fontSize: 14 }}>Eventos importantes (autenticação, cobrança e sistema)</div>
                {(operationsInsights?.recentImportantEvents?.length || 0) === 0 && <p className="adm-muted">Não há eventos importantes registrados.</p>}
                {(operationsInsights?.recentImportantEvents || []).slice(0, 6).map((event, idx) => (
                  <div className="adm-log" key={`${event.event}-${idx}`}>
                    <span>{event.event}</span>
                    <span className="adm-muted">{new Date(event.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            </div>

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
            <div className="adm-row" style={{ marginBottom: 16 }}>
              <input className="adm-input" placeholder="Código" value={code} onChange={(e) => setCode(e.target.value)} />
              <input className="adm-input" placeholder="Influenciador" value={influencer} onChange={(e) => setInfluencer(e.target.value)} />
              <button className="adm-btn" onClick={async () => { if (!code || !influencer) return; await actions.createReferral(code, influencer); setCode(''); setInfluencer(''); }}>Criar</button>
            </div>
            {referrals.map((ref) => {
              const uses = referralUsesByCode.get(ref.code) || [];
              return (
                <div key={ref.id} className="adm-user" style={{ gridTemplateColumns: '1.3fr auto auto auto' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{ref.code}</div>
                    <div className="adm-muted">{ref.influencer_name} · {ref.uses} usos</div>
                    <div className="adm-muted">Últimos usos: {uses.join(' · ') || 'nenhum'}</div>
                  </div>
                  <button className="adm-btn alt" onClick={() => actions.toggleReferral(ref.id, ref.active)}>{ref.active ? 'Pausar' : 'Ativar'}</button>
                  <span className={`adm-badge ${ref.active ? 'paid' : 'free'}`}>{ref.active ? 'ATIVO' : 'INATIVO'}</span>
                  <button className="adm-btn danger" onClick={() => destroy('Deseja apagar este código?', () => actions.deleteReferral(ref.id))}>Excluir</button>
                </div>
              );
            })}
          </section>
        )}

        {!loading && tab === 'sync' && (
          <section className="adm-card">
            <div className="adm-row" style={{ marginBottom: 16 }}>
              <button className="adm-btn" onClick={() => destroy('Executar sincronização agora?', actions.runSync)}>Rodar sync agora</button>
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
