import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Termos de Uso — LinhaCash',
};

export default function TermosPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#050505', color: '#edf3ef', fontFamily: 'Inter, -apple-system, Segoe UI, sans-serif', padding: '40px 20px 56px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <header style={{ borderTop: '3px solid #00e676', paddingTop: 28, marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#00e676', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>LinhaCash</p>
          <h1 style={{ fontSize: 'clamp(28px,4.2vw,36px)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Termos de Uso</h1>
          <p style={{ fontSize: 13, color: '#95a99f', marginTop: 8 }}>Última atualização: 1 de abril de 2026</p>
        </header>

        <Section title="1. Aceitação">
          <p>Ao acessar o LinhaCash, você concorda com estes termos e com a Política de Privacidade.</p>
        </Section>

        <Section title="2. Natureza do serviço">
          <p>
            O LinhaCash oferece conteúdo informativo e analítico sobre estatísticas e props da NBA. Não operamos apostas,
            não recebemos ordens de apostas e não garantimos resultados financeiros.
          </p>
        </Section>

        <Section title="3. Conta e acesso">
          <ul style={listStyle}>
            <li>Você é responsável por manter suas credenciais em sigilo.</li>
            <li>Não é permitido compartilhar acesso pago com terceiros sem autorização.</li>
            <li>Podemos suspender contas que violem estes termos ou a legislação vigente.</li>
          </ul>
        </Section>

        <Section title="4. Planos, cobrança e cancelamento">
          <ul style={listStyle}>
            <li>O plano Free possui limitações de uso definidas no produto.</li>
            <li>Assinaturas Pro são processadas por parceiro de pagamento (Mercado Pago).</li>
            <li>Cancelamentos podem ser solicitados pela área logada; o acesso permanece até o fim do período já pago.</li>
          </ul>
        </Section>

        <Section title="5. Uso permitido">
          <p>É proibido usar a plataforma para atividades ilícitas, scraping abusivo, engenharia reversa maliciosa ou tentativas de burlar segurança.</p>
        </Section>

        <Section title="6. Propriedade intelectual">
          <p>Interface, marca, textos e organização de dados do LinhaCash são protegidos por direitos de propriedade intelectual.</p>
        </Section>

        <Section title="7. Limitação de responsabilidade">
          <p>
            Decisões de aposta são de inteira responsabilidade do usuário. O LinhaCash não responde por perdas financeiras,
            danos indiretos ou indisponibilidades ocasionais de provedores terceiros.
          </p>
        </Section>

        <Section title="8. Alterações e contato">
          <p>Podemos atualizar estes termos quando necessário. Para dúvidas, fale com <a href="mailto:contato@linhacash.com" style={linkStyle}>contato@linhacash.com</a>.</p>
        </Section>

        <footer style={{ marginTop: 42, paddingTop: 20, borderTop: '1px solid #1a1a1a', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#6b7d74' }}>© 2026 LinhaCash. Todos os direitos reservados.</span>
          <a href="/landing.html" style={linkStyle}>← Voltar ao início</a>
        </footer>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 28, lineHeight: 1.75, color: '#c7d3cd', fontSize: 15 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f0', marginBottom: 10, borderLeft: '3px solid #00e676', paddingLeft: 12 }}>{title}</h2>
      <div style={{ paddingLeft: 15 }}>{children}</div>
    </section>
  );
}

const listStyle: React.CSSProperties = {
  paddingLeft: 20,
  marginTop: 8,
  display: 'grid',
  gap: 6,
};

const linkStyle: React.CSSProperties = {
  color: '#00e676',
  textDecoration: 'none',
};
