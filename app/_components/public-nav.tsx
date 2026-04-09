import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function PublicNav() {
  return (
    <header className="lc-public-nav">
      <div className="lc-public-container">
        <Link href="/" className="lc-brand" aria-label="LinhaCash home">
          <Image src="/logo.png" alt="LinhaCash" width={28} height={28} priority />
          <span>
            Linha<span>Cash</span>
          </span>
        </Link>
        <nav className="lc-public-actions">
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
