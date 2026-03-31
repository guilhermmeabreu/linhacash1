'use client';

import { useState, useEffect } from 'react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(true);

  const palette = dark
    ? { bg: '#070b09', card: '#0f1512', border: '#24312b', input: '#141d19', text: '#ebf5ef', muted: '#8ea69a' }
    : { bg: '#eff5f2', card: '#ffffff', border: '#ccdad3', input: '#f8fbfa', text: '#12201a', muted: '#567066' };

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem('admin_theme', next ? 'dark' : 'light');
  };

  useEffect(() => {
    if (localStorage.getItem('admin_theme') === 'light') setDark(false);
  }, []);

  async function handleLogin() {
    setError('');
    if (!email || !password) {
      setError('Preencha todos os campos para continuar.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, totpCode: totpCode || undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        window.location.href = '/admin';
        return;
      }
      setError('Não foi possível entrar. Verifique email e senha.');
    } catch {
      setError('Erro de conexão. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: palette.bg, display: 'grid', placeItems: 'center', padding: 20, fontFamily: 'Inter, sans-serif' }}>
      <button onClick={toggleTheme} style={{ position: 'fixed', top: 20, right: 20, width: 40, height: 40, border: `1px solid ${palette.border}`, background: palette.card, color: palette.muted, cursor: 'pointer', fontSize: 16 }}>
        {dark ? '☾' : '☀'}
      </button>

      <div style={{ width: '100%', maxWidth: 440, background: palette.card, border: `1px solid ${palette.border}`, padding: 32, boxShadow: dark ? '0 22px 44px rgba(0,0,0,.35)' : '0 14px 28px rgba(18,32,26,.09)' }}>
        <p style={{ fontSize: 11, color: '#00c768', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 12, fontWeight: 700 }}>Admin Access · LinhaCash</p>
        <h1 style={{ fontSize: 34, fontWeight: 800, marginBottom: 8, color: palette.text, letterSpacing: '-.03em' }}>Painel de operação</h1>
        <p style={{ fontSize: 14, color: palette.muted, marginBottom: 24, lineHeight: 1.6 }}>Acesse um ambiente seguro para gerenciar usuários, planos e sincronização de dados.</p>

        <label style={{ fontSize: 12, color: palette.muted, fontWeight: 600 }}>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="admin@linhacash.com" style={{ width: '100%', margin: '6px 0 14px', padding: 12, border: `1px solid ${palette.border}`, background: palette.input, color: palette.text, outline: 'none' }} />

        <label style={{ fontSize: 12, color: palette.muted, fontWeight: 600 }}>Senha</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} type="password" placeholder="••••••••" style={{ width: '100%', margin: '6px 0 14px', padding: 12, border: `1px solid ${palette.border}`, background: palette.input, color: palette.text, outline: 'none' }} />


        <label style={{ fontSize: 12, color: palette.muted, fontWeight: 600 }}>Código 2FA (se habilitado)</label>
        <input value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} type="text" inputMode="numeric" placeholder="000000" style={{ width: '100%', margin: '6px 0 14px', padding: 12, border: `1px solid ${palette.border}`, background: palette.input, color: palette.text, outline: 'none' }} />

        {error && <div style={{ fontSize: 13, marginBottom: 12, border: '1px solid rgba(240,82,82,.5)', background: 'rgba(240,82,82,.1)', color: '#f29b9b', padding: 10 }}>{error}</div>}

        <button disabled={loading} onClick={handleLogin} style={{ width: '100%', padding: 12, background: loading ? '#6f8379' : '#00e676', border: 'none', color: '#06200f', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1 }}>
          {loading ? 'Validando acesso...' : 'Entrar no painel'}
        </button>
      </div>
    </div>
  );
}
