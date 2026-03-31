'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminData } from './_hooks/use-admin-data';
import { adminApi, Profile } from './_lib/admin-api';

type AdminTab = 'dashboard' | 'users' | 'referrals' | 'sync';
const TABS: Array<{ key: AdminTab; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'users', label: 'Usuários' },
  { key: 'referrals', label: 'Indicações' },
  { key: 'sync', label: 'Sincronização' },
];

function PlanBadge({ user }: { user: Profile }) {
  if (user.billing?.isManualPro) return <span className="adm-badge admin">PRO ADMIN</span>;
  if (user.billing?.isPaidPro) return <span className="adm-badge paid">PRO PAID</span>;
  return <span className="adm-badge free">FREE</span>;
}

export default function AdminPage() {
  const router = useRouter();
  const { stats, users, referrals, referralUses, syncHistory, loading, feedback, loadAll, actions } = useAdminData();
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

  const destroy = async (message: string, action: () => Promise<void>) => {
    if (!window.confirm(message)) return;
    await action();
  };

  return (
    <main className="adm-page">
      <style>{`
        .adm-page{min-height:100vh;background:#080909;color:#ecf1ee;padding:24px;font-family:Inter,sans-serif}
        .adm-shell{max-width:1200px;margin:0 auto;display:grid;gap:18px}
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
        .adm-muted{color:#8ea097;font-size:13px}
        .adm-input{background:#151b19;border:1px solid #2a3531;color:#eff5f2;padding:10px 12px;min-width:220px}
        .adm-btn{background:#00e676;color:#001108;border:none;padding:10px 12px;font-weight:700;cursor:pointer}
        .adm-btn.alt{background:transparent;border:1px solid #32413c;color:#9cb0a7}
        .adm-btn.danger{background:transparent;border:1px solid #9b3131;color:#ff7676}
        .adm-btn.info{background:transparent;border:1px solid #2f6cd9;color:#8cb7ff}
        .adm-table{display:grid;gap:8px}
        .adm-user{display:grid;grid-template-columns:1.4fr auto auto auto auto;gap:8px;align-items:center;background:#121715;border:1px solid #1d2824;padding:10px}
        .adm-badge{font-size:11px;font-weight:700;padding:4px 8px}
        .adm-badge.free{background:#1a1f1d;color:#a7b6af;border:1px solid #2b3531}
        .adm-badge.paid{background:rgba(0,230,118,.12);color:#00e676;border:1px solid rgba(0,230,118,.35)}
        .adm-badge.admin{background:rgba(49,164,255,.15);color:#7dc3ff;border:1px solid rgba(49,164,255,.45)}
        .adm-feedback{padding:10px 12px;font-size:13px;border:1px solid}
        .adm-feedback.ok{border-color:#1b7f47;background:rgba(0,230,118,.1);color:#82e8b3}
        .adm-feedback.err{border-color:#913939;background:rgba(255,77,77,.1);color:#ff9c9c}
        .adm-log{display:flex;justify-content:space-between;border-bottom:1px solid #1d2824;padding:10px 0;font-size:13px}
      `}</style>
      <div className="adm-shell">
        <header className="adm-head">
          <h1 className="adm-title">Linha<em>Cash</em> Admin</h1>
          <div className="adm-row">
            <button className="adm-btn alt" onClick={() => loadAll()}>Atualizar</button>
            <button className="adm-btn alt" onClick={async () => { await adminApi.logout(); router.push('/admin/login'); }}>Sair</button>
          </div>
        </header>

        <div className="adm-tabs">
          {TABS.map((item) => (
            <button key={item.key} className={`adm-tab ${tab === item.key ? 'on' : ''}`} onClick={() => setTab(item.key)}>{item.label}</button>
          ))}
        </div>

        {feedback && <div className={`adm-feedback ${feedback.type === 'success' ? 'ok' : 'err'}`} onClick={actions.clearFeedback}>{feedback.message}</div>}

        {loading && <div className="adm-card adm-muted">Carregando painel...</div>}

        {!loading && tab === 'dashboard' && stats && (
          <section className="adm-grid">
            <div className="adm-card"><div className="adm-muted">Total de usuários</div><div className="adm-kpi">{stats.total_users}</div></div>
            <div className="adm-card"><div className="adm-muted">FREE</div><div className="adm-kpi">{stats.free_users}</div></div>
            <div className="adm-card"><div className="adm-muted">PRO PAID</div><div className="adm-kpi">{stats.pro_paid_users}</div></div>
            <div className="adm-card"><div className="adm-muted">PRO ADMIN</div><div className="adm-kpi">{stats.pro_admin_users}</div></div>
            <div className="adm-card"><div className="adm-muted">Receita mensal estimada</div><div className="adm-kpi">R$ {stats.estimated_monthly_revenue_brl.toLocaleString('pt-BR')}</div></div>
          </section>
        )}

        {!loading && tab === 'users' && (
          <section className="adm-card">
            <div className="adm-row" style={{ marginBottom: 12 }}>
              <input className="adm-input" placeholder="Buscar por nome ou email" value={search} onChange={(e) => setSearch(e.target.value)} />
              {(['all', 'pro_paid', 'pro_admin', 'free'] as const).map((item) => (
                <button key={item} className="adm-btn alt" onClick={() => setPlanFilter(item)}>{item.toUpperCase()}</button>
              ))}
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
              const uses = referralUses.filter((use) => use.code === ref.code).slice(0, 5);
              return (
                <div key={ref.id} className="adm-user" style={{ gridTemplateColumns: '1.3fr auto auto auto' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{ref.code}</div>
                    <div className="adm-muted">{ref.influencer_name} · {ref.uses} usos</div>
                    <div className="adm-muted">Últimos usos: {uses.map((use) => use.profiles?.email || use.user_id).join(' · ') || 'nenhum'}</div>
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
