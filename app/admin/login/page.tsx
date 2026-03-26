'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleLogin() {
    if (!email || !password) { setError('Preencha todos os campos.'); return; }
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.ok) {
      window.location.href = '/admin';
    } else {
      setError('Email ou senha incorretos.');
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 16, padding: 32, width: '100%', maxWidth: 380 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Linha<span style={{ color: '#00e676' }}>Cash</span></div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>Painel Admin</div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Email</div>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com"
            style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, padding: '11px 13px', fontSize: 14, color: '#fff', fontFamily: 'Inter, sans-serif', outline: 'none' }}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Senha</div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••"
            style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, padding: '11px 13px', fontSize: 14, color: '#fff', fontFamily: 'Inter, sans-serif', outline: 'none' }}
          />
        </div>
        {error && <div style={{ fontSize: 12, color: '#ff4d4d', marginBottom: 10 }}>{error}</div>}
        <button onClick={handleLogin} style={{ width: '100%', padding: 13, background: '#00e676', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, color: '#000', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          Entrar
        </button>
      </div>
    </div>
  );
}
