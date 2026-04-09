'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { Lock, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  token?: string;
  url?: string;
  user?: {
    id: string;
    name?: string;
    email?: string;
    plan?: string;
  };
};

async function authRequest(payload: Record<string, unknown>) {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as ApiResponse;
  return { status: res.status, data };
}

export function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(params.get('registered') ? 'Conta criada. Faça login para continuar.' : null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { data } = await authRequest({ action: 'login', email: email.trim(), password });
    setLoading(false);
    if (data.error || !data.token) {
      setError(data.error ?? 'Não foi possível entrar.');
      return;
    }
    localStorage.setItem('lc_token', data.token);
    window.location.assign('/app');
  }

  async function onForgot() {
    setError(null);
    setMessage(null);
    if (!email.trim()) {
      setError('Digite seu email para receber o link de recuperação.');
      return;
    }
    setLoading(true);
    const { data } = await authRequest({ action: 'forgot', email: email.trim() });
    setLoading(false);
    if (data.error) {
      setError(data.error);
      return;
    }
    setMessage('Se o email existir, enviamos um link de recuperação.');
  }

  const recoveryHref = useMemo(() => (email.trim() ? `/forgot-password?email=${encodeURIComponent(email.trim())}` : '/forgot-password'), [email]);

  return (
    <form className="lc-auth-form" onSubmit={onSubmit}>
      <label>
        Email
        <div className="lc-auth-input"><Mail size={14} /><Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required /></div>
      </label>
      <label>
        Senha
        <div className="lc-auth-input"><Lock size={14} /><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></div>
      </label>
      {error ? <p className="lc-auth-error">{error}</p> : null}
      {message ? <p className="lc-auth-success">{message}</p> : null}
      <Button type="submit" size="lg" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</Button>
      <div className="lc-auth-divider"><span>ou</span></div>
      <div className="lc-auth-row">
        <button type="button" className="lc-link-btn" onClick={onForgot} disabled={loading}>Enviar recuperação</button>
        <Link href={recoveryHref}>Abrir página de recuperação</Link>
      </div>
      <p className="lc-auth-help">Novo por aqui? <Link href="/signup">Criar conta grátis</Link></p>
      <button
        type="button"
        className="lc-google-btn"
        onClick={async () => {
          setLoading(true);
          setError(null);
          const { data } = await authRequest({ action: 'google' });
          setLoading(false);
          if (data.error || !data.url) {
            setError(data.error ?? 'Erro ao conectar com Google.');
            return;
          }
          window.location.href = data.url;
        }}
      >
        Continuar com Google
      </button>
    </form>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const { data, status } = await authRequest({ action: 'register', name: name.trim(), email: email.trim(), password });
    setLoading(false);
    if (data.error || status >= 400) {
      setError(data.error ?? 'Não foi possível criar sua conta.');
      return;
    }
    setMessage(data.message ?? 'Conta criada. Verifique seu email para confirmar.');
    router.push('/login?registered=1');
  }

  return (
    <form className="lc-auth-form" onSubmit={onSubmit}>
      <label>
        Nome
        <div className="lc-auth-input"><User size={14} /><Input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required /></div>
      </label>
      <label>
        Email
        <div className="lc-auth-input"><Mail size={14} /><Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required /></div>
      </label>
      <label>
        Senha
        <div className="lc-auth-input"><Lock size={14} /><Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} required /></div>
      </label>
      {error ? <p className="lc-auth-error">{error}</p> : null}
      {message ? <p className="lc-auth-success">{message}</p> : null}
      <Button type="submit" size="lg" disabled={loading}>{loading ? 'Criando...' : 'Criar conta grátis'}</Button>
      <p className="lc-auth-help">Já tem conta? <Link href="/login">Entrar</Link></p>
    </form>
  );
}

export function ForgotPasswordForm({ defaultEmail = '' }: { defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="lc-auth-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);
        const { data } = await authRequest({ action: 'forgot', email: email.trim() });
        setLoading(false);
        if (data.error) {
          setError(data.error);
          return;
        }
        setMessage('Se o email existir, enviamos um link com instruções de redefinição.');
      }}
    >
      <label>
        Email
        <div className="lc-auth-input"><Mail size={14} /><Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required /></div>
      </label>
      {error ? <p className="lc-auth-error">{error}</p> : null}
      {message ? <p className="lc-auth-success">{message}</p> : null}
      <Button type="submit" size="lg" disabled={loading}>{loading ? 'Enviando...' : 'Enviar link de recuperação'}</Button>
      <p className="lc-auth-help"><Link href="/login">Voltar para login</Link></p>
    </form>
  );
}

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(searchParams.get('access_token'));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function ensureRecoveryToken() {
    if (token) return token;
    const tokenHash = searchParams.get('token_hash');
    if (!tokenHash) return null;

    const res = await fetch('/api/auth/recovery/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token_hash: tokenHash, type: 'recovery' }),
    });

    const data = (await res.json().catch(() => ({}))) as ApiResponse;
    if (!res.ok || !data.token) {
      setError(data.error ?? 'Link de recuperação inválido ou expirado.');
      return null;
    }
    setToken(data.token);
    return data.token;
  }

  return (
    <form
      className="lc-auth-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        setMessage(null);

        if (newPassword.length < 8) {
          setError('A nova senha precisa ter ao menos 8 caracteres.');
          return;
        }

        if (newPassword !== confirmPassword) {
          setError('As senhas não conferem.');
          return;
        }

        setLoading(true);
        const recoveryToken = await ensureRecoveryToken();
        if (!recoveryToken) {
          setLoading(false);
          return;
        }

        const res = await fetch('/api/profile/password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${recoveryToken}`,
          },
          body: JSON.stringify({ newPassword, recovery: true }),
        });
        const data = (await res.json().catch(() => ({}))) as ApiResponse;
        setLoading(false);
        if (!res.ok || data.error) {
          setError(data.error ?? 'Não foi possível redefinir sua senha.');
          return;
        }
        setMessage('Senha redefinida com sucesso. Você já pode entrar na sua conta.');
      }}
    >
      <label>
        Nova senha
        <Input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" required />
      </label>
      <label>
        Confirmar nova senha
        <Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a senha" required />
      </label>
      {error ? <p className="lc-auth-error">{error}</p> : null}
      {message ? <p className="lc-auth-success">{message}</p> : null}
      <Button type="submit" size="lg" disabled={loading}>{loading ? 'Atualizando...' : 'Redefinir senha'}</Button>
      <p className="lc-auth-help"><Link href="/login">Ir para login</Link></p>
    </form>
  );
}
