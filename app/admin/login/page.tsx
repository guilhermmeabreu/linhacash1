'use client';
import { useState } from 'react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Barlow, sans-serif' }}>
      <div style={{ background: 'transparent', borderTop: '3px solid #00e676', borderLeft: '1px solid #1a1a1a', borderRight: '1px solid #1a1a1a', borderBottom: '1px solid #1a1a1a', borderRadius: 0, padding: 32, width: '100%', maxWidth: 380 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Linha<span style={{ color: '#00e676' }}>Cash</span></div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>Painel Admin</div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontFamily: 'IBM Plex Mono, monospace' }}>Email</div>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com"
            style={{ width: '100%', background: 'transparent', borderBottom: '2px solid #333', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0, padding: '11px 13px', fontSize: 14, color: '#fff', fontFamily: 'Barlow, sans-serif', outline: 'none' }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontFamily: 'IBM Plex Mono, monospace' }}>Senha</div>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••"
            style={{ width: '100%', background: 'transparent', borderBottom: '2px solid #333', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0, padding: '11px 13px', fontSize: 14, color: '#fff', fontFamily: 'Barlow, sans-serif', outline: 'none' }} />
        </div>
        {error && <div style={{ fontSize: 12, color: '#ff4d4d', marginBottom: 10 }}>{error}</div>}
        <button onClick={handleLogin} disabled={loading}
          style={{ width: '100%', padding: 13, background: loading ? '#888' : '#00e676', border: 'none', borderRadius: 0, fontSize: 13, fontWeight: 700, color: '#000', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Barlow, sans-serif', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Barlow, sans-serif' }}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </div>
    </div>
  );
}
