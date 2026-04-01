import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Política de Privacidade — LinhaCash',
};

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#050505',
  color: '#f0f0f0',
  fontFamily: 'Inter, -apple-system, Segoe UI, sans-serif',
  padding: '40px 20px 56px',
};

const containerStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: '0 auto',
};

export default function PrivacidadePage() {
  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <header style={{ borderTop: '3px solid #00e676', paddingTop: 28, marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#00e676', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            LinhaCash
          </p>
          <h1 style={{ fontSize: 'clamp(28px,4.2vw,36px)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Política de Privacidade</h1>
          <p style={{ fontSize: 13, color: '#95a99f', marginTop: 8 }}>Última atualização: 1 de abril de 2026</p>
        </header>

        <div style={{ lineHeight: 1.75, fontSize: 15, color: '#c7d3cd' }}>
          <Section title="1. Escopo desta política">
            <p>
              Esta política explica como o LinhaCash coleta, usa, compartilha e protege dados pessoais ao utilizar nosso site, landing page,
              aplicativo e canais de suporte.
            </p>
          </Section>

          <Section title="2. Dados coletados">
            <ul style={listStyle}>
              <li><strong>Cadastro e autenticação:</strong> nome, email e credenciais para login (incluindo login social quando disponível).</li>
              <li><strong>Assinatura e pagamentos:</strong> status do plano, identificadores de cobrança e eventos de pagamento processados pelo Mercado Pago.</li>
              <li><strong>Eventos de uso:</strong> interações com páginas, botões e recursos para análises de produto e prevenção de abuso.</li>
              <li><strong>Suporte:</strong> mensagens enviadas ao atendimento e metadados necessários para responder solicitações.</li>
              <li><strong>Dados técnicos:</strong> IP, tipo de dispositivo, navegador e logs de segurança.</li>
            </ul>
          </Section>

          <Section title="3. Finalidades do tratamento">
            <ul style={listStyle}>
              <li>criar e manter sua conta;</li>
              <li>autenticar acessos e proteger o ambiente;</li>
              <li>liberar recursos conforme plano contratado;</li>
              <li>processar cobrança, assinaturas e reembolsos;</li>
              <li>medir desempenho do produto e corrigir falhas;</li>
              <li>atender obrigações legais e regulatórias.</li>
            </ul>
          </Section>

          <Section title="4. Base legal (LGPD)">
            <p>
              Tratamos dados com base em execução de contrato, legítimo interesse, cumprimento de obrigação legal e exercício regular de direitos,
              conforme a finalidade de cada operação.
            </p>
          </Section>

          <Section title="5. Compartilhamento com terceiros">
            <p>Podemos compartilhar dados com provedores necessários para operar o serviço:</p>
            <ul style={listStyle}>
              <li><strong>Supabase:</strong> autenticação, banco de dados e armazenamento.</li>
              <li><strong>Vercel:</strong> hospedagem e entrega da aplicação.</li>
              <li><strong>Mercado Pago:</strong> processamento de pagamentos e recorrência.</li>
              <li><strong>Resend (ou provedor equivalente):</strong> envio de emails transacionais.</li>
            </ul>
            <p style={{ marginTop: 10 }}>Não vendemos dados pessoais para anunciantes.</p>
          </Section>

          <Section title="6. Cookies e tecnologias semelhantes">
            <p>
              Usamos cookies e armazenamento local para manter sessão autenticada, preferências de interface e mensuração de eventos de uso.
              Você pode gerenciar cookies no navegador, mas a desativação pode afetar funcionalidades essenciais.
            </p>
          </Section>

          <Section title="7. Retenção e segurança">
            <p>
              Mantemos dados pelo período necessário para prestação do serviço e cumprimento de obrigações legais. Aplicamos controles técnicos
              e organizacionais, como criptografia em trânsito, segregação de acesso e monitoramento de segurança.
            </p>
          </Section>

          <Section title="8. Direitos do titular">
            <p>Você pode solicitar confirmação de tratamento, acesso, correção, portabilidade, anonimização, oposição e exclusão de dados.</p>
            <p style={{ marginTop: 10 }}>
              Para exercer seus direitos, envie email para <a href="mailto:suporte@linhacash.com.br" style={linkStyle}>suporte@linhacash.com.br</a>.
            </p>
          </Section>

          <Section title="9. Atualizações desta política">
            <p>
              Podemos atualizar este documento para refletir melhorias de produto, mudanças legais ou ajustes operacionais.
              Sempre exibiremos a data da versão mais recente no topo da página.
            </p>
          </Section>
        </div>

        <footer style={{ marginTop: 42, paddingTop: 20, borderTop: '1px solid #1a1a1a', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#6b7d74' }}>© 2026 LinhaCash. Todos os direitos reservados.</span>
          <a href="/landing.html" style={linkStyle}>← Voltar ao início</a>
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
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
