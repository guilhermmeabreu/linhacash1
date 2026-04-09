import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LinhaCashLogo, ThemeToggle } from '@/components/layout';

export function PublicNav() {
  return (
    <header className="lc-public-nav">
      <div className="lc-public-container">
        <LinhaCashLogo href="/" ariaLabel="LinhaCash home" />
        <nav className="lc-public-actions">
          <ThemeToggle compact />
          <Link href="/signup">
            <Button size="sm">Começar grátis</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
