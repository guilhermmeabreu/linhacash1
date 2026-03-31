'use client';

import { useState, useEffect } from 'react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(true);

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
        body: JSON.stringify({ email, password }),
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
    <div style={{ minHeight: '100vh', background: dark ? '#070909' : '#f4f6f5', display: 'grid', placeItems: 'center', padding: 20, fontFamily: 'Inter, sans-serif' }}>
      <button onClick={toggleTheme} style={{ position: 'fixed', top: 20, right: 20, width: 38, height: 38, border: `1px solid ${dark ? '#2d3532' : '#c3ccc8'}`, background: dark ? '#111614' : '#ffffff', color: dark ? '#99aba3' : '#5e6f68', cursor: 'pointer' }}>
        {dark ? '☾' : '☀'}
      </button>
      <div style={{ width: '100%', maxWidth: 420, background: dark ? '#101513' : '#ffffff', border: `1px solid ${dark ? '#1f2723' : '#d7e0db'}`, padding: 28 }}>
        <p style={{ fontSize: 12, color: dark ? '#93a59e' : '#62746d', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Acesso administrativo</p>
        <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8, color: dark ? '#f2f8f5' : '#1b2521' }}>Linha<span style={{ color: '#00c768' }}>Cash</span></h1>
        <p style={{ fontSize: 14, color: dark ? '#8da19a' : '#62746d', marginBottom: 22 }}>Entre para gerenciar usuários, assinaturas e sincronizações.</p>

        <label style={{ fontSize: 12, color: dark ? '#9db0a8' : '#62746d' }}>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="admin@linhacash.com" style={{ width: '100%', margin: '6px 0 14px', padding: 12, border: `1px solid ${dark ? '#2b3632' : '#cad6d1'}`, background: dark ? '#141b18' : '#f9fbfa', color: dark ? '#f4fbf7' : '#18211d' }} />

        <label style={{ fontSize: 12, color: dark ? '#9db0a8' : '#62746d' }}>Senha</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} type="password" placeholder="••••••••" style={{ width: '100%', margin: '6px 0 14px', padding: 12, border: `1px solid ${dark ? '#2b3632' : '#cad6d1'}`, background: dark ? '#141b18' : '#f9fbfa', color: dark ? '#f4fbf7' : '#18211d' }} />

        {error && <div style={{ fontSize: 13, marginBottom: 12, border: '1px solid rgba(240,82,82,.5)', background: 'rgba(240,82,82,.1)', color: '#f29b9b', padding: 10 }}>{error}</div>}

        <button disabled={loading} onClick={handleLogin} style={{ width: '100%', padding: 12, background: loading ? '#73857d' : '#00e676', border: 'none', color: '#04210f', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Entrando no painel...' : 'Entrar no painel'}
        </button>
      </div>
    </div>
  );
}
