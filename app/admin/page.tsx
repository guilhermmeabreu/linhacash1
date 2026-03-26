'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const S = {
  bg: { minHeight: '100vh', background: '#000', fontFamily: 'Inter, sans-serif', color: '#fff' },
  hdr: { display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, padding: '16px 24px', borderBottom: '1px solid #2a2a2a', background: '#000', position: 'sticky' as const, top: 0, zIndex: 10 },
  card: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 14, padding: '16px 20px' },
  btn: { background: '#00e676', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#000', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  btnDanger: { background: 'none', border: '1px solid #ff4d4d', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#ff4d4d', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  btnSec: { background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#888', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  input: { background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#fff', fontFamily: 'Inter, sans-serif', outline: 'none' },
  label: { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 5, display: 'block' as const },
  tag: (c: string) => ({ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: c === 'pro' ? 'rgba(0,230,118,.15)' : '#1a1a1a', color: c === 'pro' ? '#00e676' : '#888', border: `1px solid ${c === 'pro' ? 'rgba(0,230,118,.3)' : '#2a2a2a'}` })
};

interface Profile { id: string; name: string; email: string; plan: string; created_at: string; }
interface ReferralCode { id: number; code: string; influencer_name: string; uses: number; commission_pct: number; active: boolean; }
interface Stats { total_users: number; pro_users: number; free_users: number; total_games: number; total_players: number; }

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'dashboard' | 'users' | 'referrals' | 'sync'>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [referrals, setReferrals] = useState<ReferralCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncMsg, setSyncMsg] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newInfluencer, setNewInfluencer] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [statsRes, usersRes, refRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/users'),
        fetch('/api/admin/referrals')
      ]);
      const [s, u, r] = await Promise.all([statsRes.json(), usersRes.json(), refRes.json()]);
      setStats(s);
      setUsers(u);
      setReferrals(r);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function togglePlan(userId: string, currentPlan: string) {
    const newPlan = currentPlan === 'pro' ? 'free' : 'pro';
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, plan: newPlan })
    });
    setUsers(u => u.map(x => x.id === userId ? { ...x, plan: newPlan } : x));
  }

  async function runSync() {
    setSyncMsg('Rodando sync...');
    const res = await fetch('/api/sync');
    const data = await res.json();
    setSyncMsg(data.message || data.error || 'Concluído!');
    loadAll();
  }

  async function createReferral() {
    if (!newCode || !newInfluencer) return;
    await fetch('/api/admin/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: newCode.toUpperCase(), influencer_name: newInfluencer })
    });
    setNewCode(''); setNewInfluencer('');
    loadAll();
  }

  async function toggleReferral(id: number, active: boolean) {
    await fetch('/api/admin/referrals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active: !active })
    });
    setReferrals(r => r.map(x => x.id === id ? { ...x, active: !active } : x));
  }

  async function logout() {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    router.push('/admin/login');
  }

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={S.bg}>
      <div style={S.hdr}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Linha<span style={{ color: '#00e676' }}>Cash</span> <span style={{ fontSize: 13, color: '#888', fontWeight: 400 }}>Admin</span></div>
        <button onClick={logout} style={S.btnSec}>Sair</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #2a2a2a', padding: '0 24px' }}>
        {(['dashboard', 'users', 'referrals', 'sync'] as const).map(t => (
          <div key={t} onClick={() => setTab(t)}
            style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: tab === t ? '#00e676' : '#888', borderBottom: tab === t ? '2px solid #00e676' : '2px solid transparent', textTransform: 'capitalize' }}>
            {t === 'dashboard' ? '📊 Dashboard' : t === 'users' ? '👥 Usuários' : t === 'referrals' ? '🔗 Indicações' : '⚡ Sync'}
          </div>
        ))}
      </div>

      <div style={{ padding: 24 }}>
        {loading && <div style={{ color: '#888', textAlign: 'center', padding: 40 }}>Carregando...</div>}

        {/* DASHBOARD */}
        {!loading && tab === 'dashboard' && stats && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
              {[
                { lbl: 'Total usuários', val: stats.total_users, color: '#fff' },
                { lbl: 'Plano Pro', val: stats.pro_users, color: '#00e676' },
                { lbl: 'Plano Free', val: stats.free_users, color: '#888' },
                { lbl: 'Jogos no banco', val: stats.total_games, color: '#fff' },
                { lbl: 'Jogadores', val: stats.total_players, color: '#fff' },
              ].map(m => (
                <div key={m.lbl} style={S.card}>
                  <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{m.lbl}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: m.color }}>{m.val}</div>
                </div>
              ))}
            </div>
            <div style={{ ...S.card, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>Receita estimada mensal</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#00e676' }}>
                R$ {(stats.pro_users * 24.90).toFixed(2).replace('.', ',')}
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{stats.pro_users} × R$24,90</div>
            </div>
          </div>
        )}

        {/* USERS */}
        {!loading && tab === 'users' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar usuário..." style={{ ...S.input, flex: 1 }} />
              <button onClick={loadAll} style={S.btnSec}>↺ Atualizar</button>
            </div>
            <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
              {filteredUsers.map((u, i) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < filteredUsers.length - 1 ? '1px solid #2a2a2a' : 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#00e676,#00897b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#000', flexShrink: 0 }}>
                    {(u.name || u.email || 'U')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || '—'}</div>
                    <div style={{ fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                  </div>
                  <span style={S.tag(u.plan)}>{u.plan === 'pro' ? '⚡ Pro' : 'Free'}</span>
                  <button onClick={() => togglePlan(u.id, u.plan)} style={u.plan === 'pro' ? S.btnDanger : S.btn}>
                    {u.plan === 'pro' ? 'Remover Pro' : 'Dar Pro'}
                  </button>
                </div>
              ))}
              {filteredUsers.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>Nenhum usuário encontrado</div>}
            </div>
          </div>
        )}

        {/* REFERRALS */}
        {!loading && tab === 'referrals' && (
          <div>
            <div style={{ ...S.card, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Novo código</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <label style={S.label}>Código</label>
                  <input value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} placeholder="EX: FULANO" style={{ ...S.input, width: '100%' }} />
                </div>
                <div style={{ flex: 2, minWidth: 160 }}>
                  <label style={S.label}>Nome do influenciador</label>
                  <input value={newInfluencer} onChange={e => setNewInfluencer(e.target.value)} placeholder="Nome" style={{ ...S.input, width: '100%' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button onClick={createReferral} style={S.btn}>Criar</button>
                </div>
              </div>
            </div>

            <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
              {referrals.map((r, i) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < referrals.length - 1 ? '1px solid #2a2a2a' : 'none' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: '#00e676' }}>{r.code}</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{r.influencer_name} · {r.commission_pct}% comissão</div>
                  </div>
                  <div style={{ textAlign: 'right' as const }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{r.uses}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>usos</div>
                  </div>
                  <span style={{ ...S.tag(r.active ? 'pro' : 'free') }}>{r.active ? 'Ativo' : 'Inativo'}</span>
                  <button onClick={() => toggleReferral(r.id, r.active)} style={S.btnSec}>{r.active ? 'Pausar' : 'Ativar'}</button>
                </div>
              ))}
              {referrals.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>Nenhum código criado ainda</div>}
            </div>
          </div>
        )}

        {/* SYNC */}
        {!loading && tab === 'sync' && (
          <div>
            <div style={{ ...S.card, marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Sync manual</div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Força o sync de jogos e estatísticas agora, sem esperar o cron das 04h.</div>
              <button onClick={runSync} style={S.btn}>⚡ Rodar sync agora</button>
              {syncMsg && <div style={{ marginTop: 12, fontSize: 13, color: '#00e676', background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.2)', borderRadius: 8, padding: '8px 12px' }}>{syncMsg}</div>}
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>Cron automático</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Todo dia às 04:00 (horário de Brasília)</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Configurado em vercel.json → schedule: "0 7 * * *"</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
