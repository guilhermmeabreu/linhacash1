import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="lc-auth-page">
      <section className="lc-auth-card lc-surface lc-surface-elevated">
        <Link href="/" className="lc-auth-brand" aria-label="Voltar para a página inicial">
          <Image src="/logo.png" alt="LinhaCash" width={56} height={56} priority />
          <h1>
            Linha<span>Cash</span>
          </h1>
        </Link>
        <p className="lc-auth-kicker">Análise premium de props da NBA</p>
        <h2>{title}</h2>
        <p className="lc-auth-subtitle">{subtitle}</p>
        {children}
        <footer className="lc-auth-footer">
          <Link href="/termos">Termos</Link>
          <span>·</span>
          <Link href="/privacidade">Privacidade</Link>
        </footer>
      </section>
    </main>
  );
}
