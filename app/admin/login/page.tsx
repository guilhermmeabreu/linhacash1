'use client';
import { useState, useEffect } from 'react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(true);
  const toggleTheme = () => { const n = !dark; setDark(n); localStorage.setItem('admin_theme', n?'dark':'light'); };
  useEffect(()=>{ if(localStorage.getItem('admin_theme')==='light') setDark(false); },[]);

  async function handleLogin() {
    if (!email || !password) { setError('Preencha todos os campos.'); return; }
    setLoading(true);
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.ok && data.token) {
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_email', data.email);
      window.location.href = '/admin';
    } else {
      setError('Email ou senha incorretos.');
      setLoading(false);
    }
  }

  return (<>
    <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}`}</style>
    <div style={{ minHeight: '100vh', position: 'relative' as const, background: dark?'#050505':'#f5f3ef', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Hele, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif' }}>
      <button onClick={toggleTheme} style={{ position: 'absolute' as const, top: 20, right: 20, background: 'none', border: `1px solid ${dark?'#2a2a2a':'#b0ada6'}`, color: dark?'#888':'#444', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {dark
          ? <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          : <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        }
      </button>
      <div style={{ background: dark?'transparent':'#fdfcfa', borderTop: `3px solid ${dark?'#00e676':'#00b359'}`, borderLeft: `1px solid ${dark?'#1a1a1a':'#cac7c0'}`, borderRight: `1px solid ${dark?'#1a1a1a':'#cac7c0'}`, borderBottom: `1px solid ${dark?'#1a1a1a':'#cac7c0'}`, borderRadius: 0, padding: 32, width: '100%', maxWidth: 380 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Linha<span style={{ color: '#00e676' }}>Cash</span></div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>Painel Admin</div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: dark?'#888':'#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontFamily: 'IBM Plex Mono, monospace' }}>Email</div>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com"
            style={{ width: '100%', background: 'transparent', borderBottom: `2px solid ${dark?'#333':'#b0ada6'}`, borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0, padding: '11px 13px', fontSize: 14, color: dark?'#fff':'#111', fontFamily: 'Hele, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif', outline: 'none' }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: dark?'#888':'#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontFamily: 'IBM Plex Mono, monospace' }}>Senha</div>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••"
            style={{ width: '100%', background: 'transparent', borderBottom: `2px solid ${dark?'#333':'#b0ada6'}`, borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0, padding: '11px 13px', fontSize: 14, color: dark?'#fff':'#111', fontFamily: 'Hele, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif', outline: 'none' }} />
        </div>
        {error && <div style={{ fontSize: 12, color: '#ff4d4d', marginBottom: 10 }}>{error}</div>}
        <button onClick={handleLogin} disabled={loading}
          style={{ width: '100%', padding: 13, background: loading ? '#888' : (dark?'#00e676':'#00b359'), border: 'none', borderRadius: 0, fontSize: 13, fontWeight: 700, color: '#000', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Hele, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif', cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </div>
    </div>
  </>
  );
}
