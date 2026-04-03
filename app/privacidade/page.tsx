import type { Metadata } from 'next';
import { LegalSection, listStyle, PublicLegalLayout } from '@/app/_components/public-legal-layout';

export const metadata: Metadata = {
  title: 'Política de Privacidade — LinhaCash',
};

export default function PrivacidadePage() {
  return (
    <PublicLegalLayout title="Política de Privacidade" updatedAt="3 de abril de 2026">
      <LegalSection title="1. Dados coletados">
        <ul style={listStyle}>
          <li>Dados de conta e autenticação, como nome, email e identificadores de sessão.</li>
          <li>Dados de uso e navegação para segurança, estabilidade e evolução do produto.</li>
          <li>Contexto de assinatura e status de pagamento associado ao plano.</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Finalidades do tratamento">
        <ul style={listStyle}>
          <li>Operação da conta, login e recuperação de acesso.</li>
          <li>Prevenção de abuso, monitoramento técnico e suporte ao usuário.</li>
          <li>Gestão de assinatura e atendimento financeiro.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Pagamentos e contexto financeiro">
        <p>Pagamentos são processados pelo Mercado Pago. O LinhaCash não armazena dados completos de cartão, recebendo apenas os dados necessários para confirmação e gestão da assinatura.</p>
      </LegalSection>

      <LegalSection title="4. Cookies e armazenamento local">
        <p>Utilizamos armazenamento local e tecnologias equivalentes para manter sessão, preferências de interface (como tema) e funcionamento essencial da experiência.</p>
      </LegalSection>

      <LegalSection title="5. Compartilhamento com operadores">
        <p>Podemos compartilhar dados com provedores necessários à operação do serviço, como Supabase, Vercel, Mercado Pago e ferramentas de monitoramento/analytics compatíveis com a operação do produto.</p>
      </LegalSection>

      <LegalSection title="6. Retenção e exclusão">
        <p>Os dados são mantidos pelo período necessário para cumprir as finalidades descritas e obrigações legais. Solicitações de exclusão são analisadas conforme requisitos regulatórios e de segurança.</p>
      </LegalSection>

      <LegalSection title="7. Direitos do titular">
        <p>Você pode solicitar acesso, correção, atualização, portabilidade, oposição e exclusão de dados, observadas as hipóteses legais aplicáveis.</p>
      </LegalSection>

      <LegalSection title="8. Contato para privacidade">
        <p>Para solicitações relacionadas à privacidade: contato@linhacash.com.</p>
      </LegalSection>
    </PublicLegalLayout>
  );
}
