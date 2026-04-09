import { BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function PublicNav() {
  return (
    <header className="lc-public-nav">
      <div className="lc-public-container">
        <Link href="/" className="lc-brand" aria-label="LinhaCash home">
          <span className="lc-brand-icon"><BarChart3 size={17} /></span>
          <span>
            Linha<span>Cash</span>
          </span>
        </Link>
        <nav className="lc-public-actions">
          <a href="#como-funciona">Como funciona</a>
          <a href="#planos">Planos</a>
          <Link href="/login">
            <Button variant="ghost" size="sm">Entrar</Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Começar grátis</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
