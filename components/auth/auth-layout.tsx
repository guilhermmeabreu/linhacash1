import Link from 'next/link';
import type { ReactNode } from 'react';
import { LinhaCashLogo, ThemeToggle } from '@/components/layout';

export function AuthLayout({ title, subtitle, children, mode = 'login' }: { title: string; subtitle: string; children: ReactNode; mode?: 'login' | 'signup' | 'recovery' }) {
  const isSignup = mode === 'signup';

  return (
    <main className="lc-auth-page">
      <section className="lc-auth-card lc-surface lc-surface-elevated">
        <div className="lc-auth-theme-toggle">
          <ThemeToggle compact />
        </div>
        <LinhaCashLogo
          href="/"
          className="lc-auth-brand"
          iconClassName="lc-auth-brand-icon"
          textClassName="lc-auth-brand-text"
          ariaLabel="Voltar para a página inicial"
        />
        <h2>{title}</h2>
        <p className="lc-auth-subtitle">{subtitle}</p>
        {mode !== 'recovery' ? (
          <nav className="lc-auth-tabs" aria-label="Navegação de autenticação">
            <Link href="/login" aria-current={!isSignup ? 'page' : undefined}>Entrar</Link>
            <Link href="/signup" aria-current={isSignup ? 'page' : undefined}>Criar conta</Link>
          </nav>
        ) : null}
        {children}
        <footer className="lc-auth-footer">
          <Link href="/termos">Termos</Link>
          <span>·</span>
          <Link href="/privacidade">Privacidade</Link>
          <span>·</span>
          <a href="mailto:suporte@linhacash.com.br">suporte@linhacash.com.br</a>
        </footer>
      </section>
    </main>
  );
}
