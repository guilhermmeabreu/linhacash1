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
    <div className="adm-login-page" style={{ '--bg': palette.bg, '--card': palette.card, '--border': palette.border, '--input': palette.input, '--text': palette.text, '--muted': palette.muted } as Record<string, string>}>
      <style>{`
        .adm-login-page{--bg:#070b09;--card:#0f1512;--border:#24312b;--input:#141d19;--text:#ebf5ef;--muted:#8ea69a;min-height:100vh;background:radial-gradient(circle at 50% -15%,rgba(0,230,118,.15),transparent 45%),var(--bg);display:grid;place-items:center;padding:20px;font-family:Inter,sans-serif;color:var(--text)}
        .adm-login-theme{position:fixed;top:18px;right:18px;width:42px;height:42px;border:1px solid var(--border);background:var(--card);color:var(--muted);cursor:pointer;font-size:16px}
        .adm-login-wrap{width:min(100%,1040px);display:grid;grid-template-columns:1fr;align-items:center;justify-items:center}
        .adm-login-card{width:min(100%,480px);background:var(--card);border:1px solid var(--border);padding:30px 28px;box-shadow:0 28px 52px rgba(0,0,0,.26)}
        .adm-login-eyebrow{font-size:11px;color:#00c768;text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px;font-weight:700}
        .adm-login-title{font-size:clamp(1.9rem,1.45rem + 1.45vw,2.5rem);font-weight:850;line-height:1.1;margin-bottom:10px;letter-spacing:-.03em;color:var(--text)}
        .adm-login-subtitle{font-size:14px;color:var(--muted);margin-bottom:24px;line-height:1.68;max-width:48ch}
        .adm-login-label{display:block;font-size:12px;color:var(--muted);font-weight:650;letter-spacing:.02em;margin-bottom:6px}
        .adm-login-input{width:100%;margin:0 0 14px;padding:12px 13px;border:1px solid var(--border);background:var(--input);color:var(--text);outline:none;font-size:15px;line-height:1.35}
        .adm-login-input:focus{border-color:#00c768;box-shadow:0 0 0 1px rgba(0,230,118,.24)}
        .adm-login-error{font-size:13px;line-height:1.5;margin-bottom:12px;border:1px solid rgba(240,82,82,.5);background:rgba(240,82,82,.1);color:#f29b9b;padding:10px}
        .adm-login-btn{width:100%;padding:13px 14px;background:#00e676;border:none;color:#06200f;font-weight:800;cursor:pointer;font-size:14px;letter-spacing:.01em;min-height:46px}
        .adm-login-btn:disabled{background:#6f8379;opacity:.8;cursor:not-allowed}
        @media (min-width: 960px){
          .adm-login-page{padding:42px}
          .adm-login-card{width:min(100%,560px);padding:44px 44px 40px}
          .adm-login-title{font-size:clamp(2.25rem,2rem + .75vw,2.8rem)}
          .adm-login-subtitle{font-size:15px;margin-bottom:28px}
          .adm-login-label{font-size:12px}
          .adm-login-input{font-size:15px;padding:13px 14px;margin-bottom:16px}
          .adm-login-btn{font-size:15px;min-height:50px}
        }
        @media (max-width: 599px){
          .adm-login-page{padding:16px}
          .adm-login-theme{top:12px;right:12px;width:38px;height:38px}
          .adm-login-card{padding:22px 18px;width:min(100%,420px)}
          .adm-login-subtitle{font-size:13px;line-height:1.62}
          .adm-login-input{padding:11px 12px;font-size:14px}
          .adm-login-btn{min-height:44px;font-size:14px}
        }
      `}</style>

      <button className="adm-login-theme" onClick={toggleTheme}>
        {dark ? '☾' : '☀'}
      </button>

      <div className="adm-login-wrap">
        <div className="adm-login-card">
          <p className="adm-login-eyebrow">Admin Access · LinhaCash</p>
          <h1 className="adm-login-title">Painel de operação</h1>
          <p className="adm-login-subtitle">Acesse um ambiente seguro para gerenciar usuários, planos e sincronização de dados.</p>

          <label className="adm-login-label">Email</label>
          <input className="adm-login-input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="admin@linhacash.com" />

          <label className="adm-login-label">Senha</label>
          <input className="adm-login-input" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} type="password" placeholder="••••••••" />

          <label className="adm-login-label">Código 2FA (se habilitado)</label>
          <input className="adm-login-input" value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} type="text" inputMode="numeric" placeholder="000000" />

          {error && <div className="adm-login-error">{error}</div>}

          <button className="adm-login-btn" disabled={loading} onClick={handleLogin}>
            {loading ? 'Validando acesso...' : 'Entrar no painel'}
          </button>
        </div>
      </div>
    </div>
  );
}
