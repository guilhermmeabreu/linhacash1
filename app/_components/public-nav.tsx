import Link from 'next/link';
import { LinhaCashLogo, ThemeToggle } from '@/components/layout';

export function PublicNav() {
  return (
    <header className="lc-public-nav">
      <div className="lc-public-container">
        <LinhaCashLogo href="/" ariaLabel="LinhaCash home" />
        <nav className="lc-public-actions">
          <ThemeToggle compact />
          <Link href="/login" className="lc-btn lc-btn-sm lc-public-login-cta">
            Entrar/Criar Conta
          </Link>
        </nav>
      </div>
    </header>
  );
}
