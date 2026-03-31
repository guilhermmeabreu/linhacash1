'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const S_static = {
 btn: { background: '#00e676', border: 'none', borderRadius: 0, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#000', cursor: 'pointer', fontFamily: 'Hele, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif' },
 btnDanger: { background: 'none', border: '1px solid #ff4d4d', borderRadius: 0, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#ff4d4d', cursor: 'pointer', fontFamily: 'Hele, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif' },
 btnInfo: { background: 'none', border: '1px solid #0077ff', borderRadius: 0, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#0077ff', cursor: 'pointer', fontFamily: 'Hele, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif' },
};

interface Profile { id: string; name: string; email: string; plan: string; created_at: string; referral_code_used?: string; }
interface ReferralCode { id: number; code: string; influencer_name: string; uses: number; commission_pct: number; active: boolean; }
interface ReferralUse { id: number; code: string; user_id: string; created_at: string; profiles?: { name: string; email: string; }; }
interface Stats { total_users: number; pro_users: number; free_users: number; total_games: number; total_players: number; recent_signups: any[]; }

export default function AdminPage() {
 const router = useRouter();
 const [tab, setTab] = useState<'dashboard' | 'users' | 'referrals' | 'sync' | 'support'>('dashboard');
 const [stats, setStats] = useState<Stats | null>(null);
 const [users, setUsers] = useState<Profile[]>([]);
 const [referrals, setReferrals] = useState<ReferralCode[]>([]);
 const [referralUses, setReferralUses] = useState<ReferralUse[]>([]);
 const [loading, setLoading] = useState(true);
 const [syncMsg, setSyncMsg] = useState('');
 const [syncLogs, setSyncLogs] = useState('');
 const [newCode, setNewCode] = useState('');
 const [newInfluencer, setNewInfluencer] = useState('');
 const [search, setSearch] = useState('');
 const [planFilter, setPlanFilter] = useState<'all' | 'pro' | 'free'>('all');
 const [selectedRef, setSelectedRef] = useState<string | null>(null);
 const [darkMode, setDarkMode] = useState(true);

 const toggleTheme = () => {
   const next = !darkMode;
   setDarkMode(next);
   localStorage.setItem('admin_theme', next ? 'dark' : 'light');
 };

 useEffect(() => {
   const saved = localStorage.getItem('admin_theme');
   if (saved === 'light') setDarkMode(false);
 }, []);

 useEffect(() => {
   loadAll();
 }, []);

 function getHeaders() {
 return { 'Content-Type': 'application/json' };
 }

 async function loadAll() {
 setLoading(true);
 try {
 const [statsRes, usersRes, refRes, refUsesRes] = await Promise.all([
 fetch('/api/admin/stats'),
 fetch('/api/admin/users'),
 fetch('/api/admin/referrals'),
 fetch('/api/admin/referral-uses')
 ]);
 const [s, u, r, ru] = await Promise.all([statsRes.json(), usersRes.json(), refRes.json(), refUsesRes.json()]);
 if (statsRes.status === 401) { router.push('/admin/login'); return; }
 if (s && !s.error) setStats(s);
 if (Array.isArray(u)) setUsers(u);
 if (Array.isArray(r)) setReferrals(r);
 if (Array.isArray(ru)) setReferralUses(ru);
 } catch (e) { console.error(e); }
 setLoading(false);
 }

 async function togglePlan(userId: string, currentPlan: string) {
 const newPlan = currentPlan === 'pro' ? 'free' : 'pro';
 await fetch('/api/admin/users', {
 method: 'PATCH',
 headers: getHeaders(),
 body: JSON.stringify({ id: userId, plan: newPlan })
 });
 setUsers(u => u.map(x => x.id === userId ? { ...x, plan: newPlan } : x));
 if (stats) setStats({ ...stats, pro_users: stats.pro_users + (newPlan === 'pro' ? 1 : -1), free_users: stats.free_users + (newPlan === 'free' ? 1 : -1) });
 }

 async function deleteUser(userId: string) {
 if (!confirm('Tem certeza? Isso vai apagar o usuário permanentemente.')) return;
 await fetch('/api/admin/users', {
 method: 'DELETE',
 headers: getHeaders(),
 body: JSON.stringify({ id: userId })
 });
 setUsers(u => u.filter(x => x.id !== userId));
 }

 async function resetPassword(email: string) {
 await fetch('/api/admin/users', {
 method: 'PUT',
 headers: getHeaders(),
 body: JSON.stringify({ email })
 });
 alert(`Email de reset enviado para ${email}`);
 }

 async function runSync() {
 setSyncMsg('Rodando sync...');
 setSyncLogs('');
 const res = await fetch('/api/sync');
 const data = await res.json();
 setSyncMsg(data.message || data.error || 'Concluído!');
 setSyncLogs(JSON.stringify(data, null, 2));
 loadAll();
 }

 async function createReferral() {
 if (!newCode || !newInfluencer) return;
 await fetch('/api/admin/referrals', {
 method: 'POST',
 headers: getHeaders(),
 body: JSON.stringify({ code: newCode.toUpperCase(), influencer_name: newInfluencer })
 });
 setNewCode(''); setNewInfluencer('');
 loadAll();
 }

 async function toggleReferral(id: number, active: boolean) {
 await fetch('/api/admin/referrals', {
 method: 'PATCH',
 headers: getHeaders(),
 body: JSON.stringify({ id, active: !active })
 });
 setReferrals(r => r.map(x => x.id === id ? { ...x, active: !active } : x));
 }

 async function deleteReferral(id: number) {
 if (!confirm('Apagar este código?')) return;
 await fetch('/api/admin/referrals', {
 method: 'DELETE',
 headers: getHeaders(),
 body: JSON.stringify({ id })
 });
 setReferrals(r => r.filter(x => x.id !== id));
 }

 async function logout() {
 await fetch('/api/admin/auth', { method: 'DELETE' });
 router.push('/admin/login');
 }

 const filteredUsers = users.filter(u => {
 const matchSearch = u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
 const matchPlan = planFilter === 'all' || u.plan === planFilter;
 return matchSearch && matchPlan;
 });

 const usesForCode = (code: string) => referralUses.filter(u => u.code === code);

 function SyncHistory({ dark }: { dark: boolean }) {
 const [logs, setLogs] = useState<any[]>([]);
 useEffect(() => {
 fetch('/api/admin/sync-logs')
 .then(r => r.json()).then(d => { if (Array.isArray(d)) setLogs(d); });
 }, []);
 const cardStyle = { background: dark?'#0f0f0f':'#fdfcfa', border: `1px solid ${dark?'#1e1e1e':'#cac7c0'}`, borderLeft: `3px solid ${dark?'#00e676':'#00b359'}`, borderRadius: 0, padding: '16px 20px' };
 return (
 <div style={cardStyle}>
 <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: dark?'#f0f0f0':'#111' }}>Histórico de syncs</div>
 {logs.length === 0 && <div style={{ color: dark?'#888':'#555', fontSize: 13 }}>Nenhum sync registrado ainda</div>}
 {logs.map((l, i) => (
 <div key={i} style={{ padding: '10px 0', borderBottom: i < logs.length - 1 ? `1px solid ${dark?'#2a2a2a':'#cac7c0'}` : 'none' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <span style={{ fontSize: 13, fontWeight: 600, color: l.status === 'success' ? (dark?'#00e676':'#00955a') : l.status === 'error' ? '#ff4d4d' : (dark?'#888':'#555') }}>
 {l.status}
 </span>
 <span style={{ fontSize: 11, color: dark?'#888':'#555' }}>{new Date(l.created_at).toLocaleString('pt-BR')}</span>
 </div>
 <div style={{ fontSize: 12, color: dark?'#888':'#555', marginTop: 2 }}>{l.games_synced} jogos · {l.errors ? 'com erros' : 'sem erros'}</div>
 </div>
 ))}
 </div>
 );
 }

 const d = darkMode;
 const S = {
   bg: { minHeight: '100vh', background: d?'#050505':'#f5f3ef', fontFamily: 'Hele,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', color: d?'#f0f0f0':'#111' },
   hdr: { display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, padding: '16px 24px', borderBottom: `1px solid ${d?'#1a1a1a':'#cac7c0'}`, background: d?'#050505':'#f5f3ef', position: 'sticky' as const, top: 0, zIndex: 10 },
   card: { background: d?'#0f0f0f':'#fdfcfa', border: `1px solid ${d?'#1e1e1e':'#cac7c0'}`, borderLeft: `3px solid ${d?'#00e676':'#00b359'}`, borderRadius: 0, padding: '16px 20px' },
   btn: { background: d?'#00e676':'#00b359', border: 'none', borderRadius: 0, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#000', cursor: 'pointer', fontFamily: 'Hele,-apple-system,sans-serif' },
   btnDanger: { background: 'none', border: '1px solid #ff4d4d', borderRadius: 0, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#ff4d4d', cursor: 'pointer', fontFamily: 'Hele,-apple-system,sans-serif' },
   btnSec: { background: 'none', border: `1px solid ${d?'#2a2a2a':'#b0ada6'}`, borderRadius: 0, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: d?'#888':'#555', cursor: 'pointer', fontFamily: 'Hele,-apple-system,sans-serif' },
   btnInfo: { background: 'none', border: '1px solid #0077ff', borderRadius: 0, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#0077ff', cursor: 'pointer', fontFamily: 'Hele,-apple-system,sans-serif' },
   input: { background: d?'#1a1a1a':'#fff', border: `1px solid ${d?'#333':'#b0ada6'}`, borderRadius: 0, padding: '8px 12px', fontSize: 13, color: d?'#fff':'#111', fontFamily: 'Hele,-apple-system,sans-serif', outline: 'none' },
   label: { fontSize: 11, fontWeight: 700, color: d?'#888':'#555', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 5, display: 'block' as const },
   tag: (c: string) => ({ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 0, background: c==='pro'?(d?'rgba(0,230,118,.15)':'rgba(0,179,89,.12)'):(d?'#1a1a1a':'#edeae4'), color: c==='pro'?(d?'#00e676':'#00955a'):(d?'#888':'#555'), border: `1px solid ${c==='pro'?(d?'rgba(0,230,118,.3)':'rgba(0,179,89,.4)'):(d?'#2a2a2a':'#cac7c0')}` }),
 };

 return (
 <div style={S.bg}>
 <div style={S.hdr}>
 <div style={{ fontSize: 18, fontWeight: 800 }}>Linha<span style={{ color: d?'#00e676':'#00b359' }}>Cash</span> <span style={{ fontSize: 13, color: d?'#888':'#666', fontWeight: 400 }}>Admin</span></div>
 <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
 <span style={{ fontSize: 12, color: '#888' }}>
 {stats ? `${stats.total_users} usuários · ${stats.pro_users} Pro` : ''}
 </span>
 <button onClick={logout} style={S.btnSec}>Sair</button>
 <button onClick={toggleTheme} style={{ background: 'none', border: `1px solid ${darkMode?'#2a2a2a':'#b0ada6'}`, color: darkMode?'#888':'#444', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
   {darkMode
     ? <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
     : <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
   }
 </button>
 </div>
 </div>

 {/* Tabs */}
 <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${d?'#2a2a2a':'#cac7c0'}`, padding: '0 24px', overflowX: 'auto' }}>
 {([
 { k: 'dashboard', l: 'Dashboard' },
 { k: 'users', l: 'Usuários' },
 { k: 'referrals', l: 'Indicações' },
 { k: 'sync', l: 'Sync' },
 { k: 'support', l: 'Suporte' }
 ] as const).map(t => (
 <div key={t.k} onClick={() => setTab(t.k)}
 style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: tab === t.k ? (d?'#00e676':'#00955a') : (d?'#888':'#555'), borderBottom: tab === t.k ? `2px solid ${d?'#00e676':'#00955a'}` : '2px solid transparent', whiteSpace: 'nowrap' }}>
 {t.l}
 </div>
 ))}
 </div>

 <div style={{ padding: 24 }}>
 {loading && <div style={{ color: d?'#888':'#555', textAlign: 'center', padding: 40 }}>Carregando...</div>}

 {/* DASHBOARD */}
 {!loading && tab === 'dashboard' && stats && (
 <div>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
 {[
 { lbl: 'Total usuários', val: stats.total_users, color: d?'#fff':'#111' },
 { lbl: 'Plano Pro', val: stats.pro_users, color: '#00e676' },
 { lbl: 'Plano Free', val: stats.free_users, color: d?'#888':'#555' },
 { lbl: 'Jogos no banco', val: stats.total_games, color: d?'#fff':'#111' },
 { lbl: 'Jogadores', val: stats.total_players, color: '#fff' },
 ].map(m => (
 <div key={m.lbl} style={S.card}>
 <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{m.lbl}</div>
 <div style={{ fontSize: 28, fontWeight: 700, color: m.color }}>{m.val}</div>
 </div>
 ))}
 </div>

 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
 <div style={S.card}>
 <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>Receita estimada mensal</div>
 <div style={{ fontSize: 32, fontWeight: 800, color: '#00e676' }}>
 R$ {(stats.pro_users * 24.90).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
 </div>
 <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{stats.pro_users} × R$24,90 · líquido ~R$ {(stats.pro_users * 24.90 * 0.7).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
 </div>
 <div style={S.card}>
 <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>Conversão Free → Pro</div>
 <div style={{ fontSize: 32, fontWeight: 800, color: '#fff' }}>
 {stats.total_users > 0 ? Math.round(stats.pro_users / stats.total_users * 100) : 0}%
 </div>
 <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{stats.pro_users} de {stats.total_users} usuários</div>
 </div>
 </div>

 {/* Últimos cadastros */}
 <div style={{ ...S.card }}>
 <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Últimos cadastros</div>
 {stats.recent_signups?.slice(0, 5).map((u: any, i: number) => (
 <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < 4 ? '1px solid #2a2a2a' : 'none' }}>
 <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#00e676,#00897b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#000', flexShrink: 0 }}>
 {(u.name || u.email || 'U')[0].toUpperCase()}
 </div>
 <div style={{ flex: 1 }}>
 <div style={{ fontSize: 13, fontWeight: 600 }}>{u.name || '—'}</div>
 <div style={{ fontSize: 11, color: '#888' }}>{u.email}</div>
 </div>
 <span style={S.tag(u.plan)}>{u.plan === 'pro' ? ' Pro' : 'Free'}</span>
 <div style={{ fontSize: 11, color: '#888' }}>{new Date(u.created_at).toLocaleDateString('pt-BR')}</div>
 </div>
 ))}
 {!stats.recent_signups?.length && <div style={{ color: '#888', fontSize: 13 }}>Nenhum cadastro ainda</div>}
 </div>
 </div>
 )}

 {/* USUÁRIOS */}
 {!loading && tab === 'users' && (
 <div>
 <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
 <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou email..." style={{ ...S.input, flex: 1, minWidth: 200 }} />
 <div style={{ display: 'flex', gap: 6 }}>
 {(['all', 'pro', 'free'] as const).map(f => (
 <button key={f} onClick={() => setPlanFilter(f)} style={{ ...S.btnSec, color: planFilter === f ? '#00e676' : '#888', borderColor: planFilter === f ? '#00e676' : '#2a2a2a' }}>
 {f === 'all' ? 'Todos' : f === 'pro' ? ' Pro' : 'Free'}
 </button>
 ))}
 </div>
 <button onClick={loadAll} style={S.btnSec}>↺</button>
 </div>
 <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>{filteredUsers.length} usuários encontrados</div>
 <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
 {filteredUsers.map((u, i) => (
 <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: i < filteredUsers.length - 1 ? '1px solid #2a2a2a' : 'none', flexWrap: 'wrap' }}>
 <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#00e676,#00897b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#000', flexShrink: 0 }}>
 {(u.name || u.email || 'U')[0].toUpperCase()}
 </div>
 <div style={{ flex: 1, minWidth: 150 }}>
 <div style={{ fontSize: 14, fontWeight: 600 }}>{u.name || '—'}</div>
 <div style={{ fontSize: 12, color: '#888' }}>{u.email}</div>
 {u.referral_code_used && <div style={{ fontSize: 11, color: '#00e676', marginTop: 2 }}>código: {u.referral_code_used}</div>}
 <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{new Date(u.created_at).toLocaleDateString('pt-BR')}</div>
 </div>
 <span style={S.tag(u.plan)}>{u.plan === 'pro' ? ' Pro' : 'Free'}</span>
 <button onClick={() => togglePlan(u.id, u.plan)} style={u.plan === 'pro' ? S.btnDanger : S.btn}>
 {u.plan === 'pro' ? 'Remover Pro' : 'Dar Pro'}
 </button>
 <button onClick={() => resetPassword(u.email)} style={S.btnInfo}>Reset senha</button>
 <button onClick={() => deleteUser(u.id)} style={S.btnDanger}></button>
 </div>
 ))}
 {filteredUsers.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>Nenhum usuário encontrado</div>}
 </div>
 </div>
 )}

 {/* INDICAÇÕES */}
 {!loading && tab === 'referrals' && (
 <div>
 <div style={{ ...S.card, marginBottom: 16 }}>
 <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Novo código</div>
 <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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

 <div style={{ ...S.card, padding: 0, overflow: 'hidden', marginBottom: 16 }}>
 {referrals.map((r, i) => (
 <div key={r.id}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #2a2a2a', flexWrap: 'wrap' }}>
 <div style={{ flex: 1, minWidth: 150 }}>
 <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: '#00e676' }}>{r.code}</div>
 <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{r.influencer_name} · {r.commission_pct}% comissão</div>
 <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>
 Receita gerada: <span style={{ color: '#00e676' }}>R$ {(r.uses * 24.90 * r.commission_pct / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
 </div>
 </div>
 <div style={{ textAlign: 'right' }}>
 <div style={{ fontSize: 22, fontWeight: 700 }}>{r.uses}</div>
 <div style={{ fontSize: 11, color: '#888' }}>assinantes</div>
 </div>
 <span style={{ ...S.tag(r.active ? 'pro' : 'free') }}>{r.active ? 'Ativo' : 'Inativo'}</span>
 <button onClick={() => setSelectedRef(selectedRef === r.code ? null : r.code)} style={S.btnInfo}>
 {selectedRef === r.code ? 'Fechar' : 'Ver usuários'}
 </button>
 <button onClick={() => toggleReferral(r.id, r.active)} style={S.btnSec}>{r.active ? 'Pausar' : 'Ativar'}</button>
 <button onClick={() => deleteReferral(r.id)} style={S.btnDanger}></button>
 </div>
 {/* Lista de usuários que usaram esse código */}
 {selectedRef === r.code && (
 <div style={{ background: '#0a0a0a', padding: '10px 16px', borderBottom: '1px solid #2a2a2a' }}>
 {usesForCode(r.code).length === 0
 ? <div style={{ fontSize: 12, color: '#888' }}>Nenhum usuário usou este código ainda</div>
 : usesForCode(r.code).map((u, j) => (
 <div key={j} style={{ fontSize: 12, color: '#ccc', padding: '4px 0', borderBottom: j < usesForCode(r.code).length - 1 ? '1px solid #1a1a1a' : 'none' }}>
 <span style={{ color: '#00e676' }}></span> {u.profiles?.email || u.user_id} · {new Date(u.created_at).toLocaleDateString('pt-BR')}
 </div>
 ))
 }
 </div>
 )}
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
 <button onClick={runSync} style={S.btn}> Rodar sync agora</button>
 {syncMsg && <div style={{ marginTop: 12, fontSize: 13, color: '#00e676', background: 'rgba(0,230,118,.1)', border: '1px solid rgba(0,230,118,.2)', borderRadius: 0, padding: '8px 12px' }}>{syncMsg}</div>}
 {syncLogs && <pre style={{ marginTop: 10, fontSize: 11, color: '#888', background: '#0a0a0a', borderRadius: 0, padding: 12, overflow: 'auto', maxHeight: 300 }}>{syncLogs}</pre>}
 </div>
 <div style={{ ...S.card, marginBottom: 16 }}>
 <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>Cron automático</div>
 <div style={{ fontSize: 14, fontWeight: 600 }}>Todo dia às 04:00 (horário de Brasília)</div>
 <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>schedule: "0 7 * * *" (UTC)</div>
 </div>
 <SyncHistory dark={darkMode} />
 </div>
 )}

 {/* SUPORTE */}
 {!loading && tab === 'support' && (
 <div>
 <div style={S.card}>
 <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Central de Suporte</div>
 <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
 Configure um canal de suporte para seus clientes entrarem em contato.
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
 <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 0, padding: 14 }}>
 <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}> WhatsApp Business</div>
 <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>Crie um número separado para o negócio. Clientes clicam e abrem direto no WhatsApp.</div>
 <div style={{ fontSize: 12, color: '#00e676' }}>Em breve — adicione seu número do WhatsApp Business nas configurações</div>
 </div>
 <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 0, padding: 14 }}>
 <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}> Email de suporte</div>
 <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>Quando tiver o domínio: suporte@linhacash.com.br</div>
 <div style={{ fontSize: 12, color: '#00e676' }}>Configure após comprar o domínio linhacash.com.br</div>
 </div>
 <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 0, padding: 14 }}>
 <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}> Estatísticas de suporte</div>
 <div style={{ fontSize: 12, color: '#888' }}>Total de chamados, tempo médio de resposta e satisfação dos clientes. Disponível quando integrar um canal.</div>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}
