import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { LinhaCashLogo, ThemeToggle } from '@/components/layout';

export function PublicLegalLayout({
  title,
  updatedAt,
  backHref = '/app',
  children,
}: {
  title: string;
  updatedAt: string;
  backHref?: string;
  children: ReactNode;
}) {
  return (
    <main className="lc-legal-page">
      <div className="lc-legal-shell">
        <header className="lc-legal-header">
          <div className="lc-legal-header-left">
            <Link href={backHref} className="lc-legal-back" aria-label="Voltar para o aplicativo">
              <ArrowLeft size={16} />
            </Link>
            <LinhaCashLogo href="/" ariaLabel="LinhaCash home" />
          </div>
          <div className="lc-legal-header-actions">
            <ThemeToggle compact />
            <p>Última atualização: {updatedAt}</p>
          </div>
        </header>

        <section className="lc-legal-content">
          <h1>{title}</h1>
          <div>{children}</div>
        </section>
      </div>

      <footer className="lc-legal-footer">
        <p>
          <Link href="/termos">Termos de uso</Link> · <Link href="/privacidade">Política de privacidade</Link>
        </p>
        <p><a href="mailto:suporte@linhacash.com.br">suporte@linhacash.com.br</a></p>
        <p>Uso responsável: o LinhaCash não é casa de apostas e não garante resultados.</p>
      </footer>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="lc-legal-section">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}

export const listStyle: CSSProperties = {
  paddingLeft: '1.1rem',
  marginTop: '0.65rem',
  display: 'grid',
  gap: '0.5rem',
  lineHeight: 1.7,
};
