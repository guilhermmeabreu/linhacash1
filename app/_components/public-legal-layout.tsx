import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';

export function PublicLegalLayout({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <main style={{ minHeight: '100vh', background: '#070908', color: '#ecf5f1', fontFamily: 'Inter, -apple-system, Segoe UI, sans-serif' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '32px 20px 54px' }}>
        <header style={{ borderBottom: '1px solid #24312b', paddingBottom: 16, marginBottom: 26, display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#ecf5f1', fontWeight: 800, letterSpacing: '-.02em' }}>
            <Image src="/logo.png" alt="LinhaCash" width={24} height={24} />
            <span>Linha<span style={{ color: '#00e676' }}>Cash</span></span>
          </Link>
          <div style={{ color: '#95a99f', fontSize: 13 }}>Última atualização: {updatedAt}</div>
        </header>

        <section style={{ maxWidth: 760, margin: '0 auto' }}>
          <h1 style={{ fontSize: 'clamp(30px,4vw,38px)', letterSpacing: '-.03em', marginBottom: 18 }}>{title}</h1>
          <div style={{ lineHeight: 1.75, fontSize: 15, color: '#c7d3cd' }}>{children}</div>
        </section>
      </div>

      <footer style={{ borderTop: '1px solid #24312b', padding: '22px 20px 30px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 8, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#95a99f' }}>
            <Link href="/termos" style={linkStyle}>Termos de uso</Link> · <Link href="/privacidade" style={linkStyle}>Política de privacidade</Link>
          </p>
          <p style={{ fontSize: 13 }}><a href="mailto:contato@linhacash.com" style={linkStyle}>contato@linhacash.com</a></p>
          <p style={{ fontSize: 12, color: '#95a99f' }}>Uso responsável: o LinhaCash não é casa de apostas, não intermedia apostas e não garante resultados.</p>
          <p style={{ fontSize: 12, color: '#95a99f' }}>© 2026 LinhaCash. Todos os direitos reservados.</p>
        </div>
      </footer>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f0', marginBottom: 10, borderLeft: '3px solid #00e676', paddingLeft: 12 }}>{title}</h2>
      <div style={{ paddingLeft: 15 }}>{children}</div>
    </section>
  );
}

export const listStyle: React.CSSProperties = {
  paddingLeft: 20,
  marginTop: 8,
  display: 'grid',
  gap: 6,
};

const linkStyle: React.CSSProperties = {
  color: '#ecf5f1',
  textDecoration: 'none',
};
