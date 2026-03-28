import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidade — LinhaCash',
};

export default function PrivacidadePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#f0f0f0', fontFamily: 'Barlow, sans-serif', padding: '40px 20px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ borderTop: '3px solid #00e676', paddingTop: 32, marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#00e676', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>LinhaCash</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Política de Privacidade</h1>
        <p style={{ fontSize: 13, color: '#888', marginTop: 8 }}>Última atualização: março de 2026</p>
      </div>

      <div style={{ lineHeight: 1.8, fontSize: 15 }}>

        <Section title="1. Quem somos">
          <p>O LinhaCash é uma plataforma brasileira de análise de estatísticas da NBA para fins informativos. Operado por pessoa física (CPF/CNPJ do operador), com sede no Brasil. Contato: <a href="mailto:suporte@linhacash.com.br" style={{ color: '#00e676' }}>suporte@linhacash.com.br</a></p>
        </Section>

        <Section title="2. Dados que coletamos">
          <p>Coletamos apenas o necessário para o funcionamento da plataforma:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li><strong>Nome e email</strong> — fornecidos no cadastro, para identificação e comunicação</li>
            <li><strong>Dados de pagamento</strong> — processados pelo Mercado Pago. Não armazenamos dados de cartão</li>
            <li><strong>Plano de assinatura</strong> — para controle de acesso às features</li>
            <li><strong>Código de indicação</strong> — se usado no cadastro, para rastreamento de parceiros</li>
            <li><strong>Dados de uso</strong> — acessos às funcionalidades, para melhoria do serviço</li>
          </ul>
          <p style={{ marginTop: 12 }}><strong>Não coletamos:</strong> CPF, endereço, dados bancários, dados sensíveis conforme LGPD Art. 11.</p>
        </Section>

        <Section title="3. Para que usamos seus dados">
          <ul style={{ paddingLeft: 20 }}>
            <li>Criar e gerenciar sua conta</li>
            <li>Processar pagamentos e controlar assinaturas</li>
            <li>Enviar emails transacionais (confirmação, recibo, suporte)</li>
            <li>Melhorar a plataforma com base no uso</li>
            <li>Cumprir obrigações legais</li>
          </ul>
          <p style={{ marginTop: 12 }}>Base legal: <strong>execução de contrato</strong> (LGPD Art. 7º, V) e <strong>legítimo interesse</strong> (LGPD Art. 7º, IX).</p>
        </Section>

        <Section title="4. Com quem compartilhamos">
          <p>Compartilhamos seus dados somente com:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li><strong>Supabase</strong> — banco de dados e autenticação (servidores nos EUA, adequação GDPR)</li>
            <li><strong>Mercado Pago</strong> — processamento de pagamentos (sujeito à política do MP)</li>
            <li><strong>Resend</strong> — envio de emails transacionais</li>
            <li><strong>Vercel</strong> — hospedagem da aplicação</li>
          </ul>
          <p style={{ marginTop: 12 }}><strong>Nunca vendemos seus dados.</strong> Nunca compartilhamos com anunciantes.</p>
        </Section>

        <Section title="5. Seus direitos (LGPD Art. 18)">
          <p>Você tem direito a:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li><strong>Acesso</strong> — saber quais dados temos sobre você</li>
            <li><strong>Correção</strong> — corrigir dados incorretos no seu perfil</li>
            <li><strong>Exclusão</strong> — solicitar a exclusão completa da sua conta e dados</li>
            <li><strong>Portabilidade</strong> — receber seus dados em formato estruturado</li>
            <li><strong>Revogação</strong> — revogar consentimento a qualquer momento</li>
            <li><strong>Oposição</strong> — se opor ao tratamento baseado em legítimo interesse</li>
          </ul>
          <p style={{ marginTop: 12 }}>Para exercer seus direitos: acesse <strong>Perfil → Excluir minha conta</strong> ou envie email para <a href="mailto:suporte@linhacash.com.br" style={{ color: '#00e676' }}>suporte@linhacash.com.br</a>. Respondemos em até <strong>15 dias úteis</strong>.</p>
        </Section>

        <Section title="6. Por quanto tempo guardamos seus dados">
          <ul style={{ paddingLeft: 20 }}>
            <li>Dados de conta: enquanto a conta estiver ativa</li>
            <li>Dados de pagamento: 5 anos (obrigação fiscal)</li>
            <li>Logs de acesso: 6 meses</li>
            <li>Após exclusão da conta: dados apagados em até 30 dias dos sistemas de backup</li>
          </ul>
        </Section>

        <Section title="7. Segurança">
          <p>Adotamos as seguintes medidas de segurança:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li>Comunicação criptografada via HTTPS/TLS</li>
            <li>Banco de dados com Row Level Security (RLS) — cada usuário acessa só seus dados</li>
            <li>Senhas com hash seguro (Supabase Auth)</li>
            <li>Chaves de API nunca expostas ao frontend</li>
            <li>Rate limiting para prevenção de ataques</li>
            <li>Proteção contra XSS e clickjacking via headers de segurança</li>
          </ul>
          <p style={{ marginTop: 12 }}>Em caso de incidente de segurança, notificaremos os usuários afetados e a ANPD em até <strong>72 horas</strong>, conforme LGPD Art. 48.</p>
        </Section>

        <Section title="8. Cookies">
          <p>Utilizamos apenas cookies essenciais para o funcionamento da plataforma (sessão de autenticação). Não utilizamos cookies de rastreamento ou publicidade.</p>
        </Section>

        <Section title="9. Menores de idade">
          <p>O LinhaCash é destinado a maiores de 18 anos. Não coletamos intencionalmente dados de menores. Se identificarmos cadastro de menor, excluiremos a conta imediatamente.</p>
        </Section>

        <Section title="10. Alterações nesta política">
          <p>Podemos atualizar esta política periodicamente. Notificaremos por email sobre mudanças significativas. A data de última atualização está no topo desta página.</p>
        </Section>

        <Section title="11. Contato e encarregado de dados (DPO)">
          <p>Para dúvidas, solicitações ou reclamações relacionadas à privacidade:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li>Email: <a href="mailto:suporte@linhacash.com.br" style={{ color: '#00e676' }}>suporte@linhacash.com.br</a></li>
            <li>Prazo de resposta: até 15 dias úteis</li>
          </ul>
          <p style={{ marginTop: 12 }}>Você também pode reclamar à <strong>ANPD</strong> (Autoridade Nacional de Proteção de Dados): <a href="https://www.gov.br/anpd" style={{ color: '#00e676' }} target="_blank">www.gov.br/anpd</a></p>
        </Section>

      </div>

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#555' }}>© 2026 LinhaCash. Todos os direitos reservados.</span>
        <a href="/app.html" style={{ fontSize: 13, color: '#00e676', textDecoration: 'none' }}>← Voltar ao app</a>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f0', marginBottom: 12, borderLeft: '3px solid #00e676', paddingLeft: 12 }}>{title}</h2>
      <div style={{ color: '#aaa', paddingLeft: 15 }}>{children}</div>
    </div>
  );
}
