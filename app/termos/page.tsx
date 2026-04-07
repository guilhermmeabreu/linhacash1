import type { Metadata } from 'next';
import { LegalSection, listStyle, PublicLegalLayout } from '@/app/_components/public-legal-layout';

export const metadata: Metadata = {
  title: 'Termos de Uso — LinhaCash',
};

export default function TermosPage() {
  return (
    <PublicLegalLayout title="Termos de Uso" updatedAt="3 de abril de 2026">
      <LegalSection title="1. Descrição do serviço">
        <p>O LinhaCash é uma plataforma informativa de análise de dados esportivos. Não somos casa de apostas, não intermediamos apostas e não executamos ordens de aposta.</p>
      </LegalSection>

      <LegalSection title="2. Finalidade da plataforma">
        <p>O conteúdo disponibilizado tem foco em leitura de desempenho, tendências e contexto para apoiar decisões do usuário.</p>
      </LegalSection>

      <LegalSection title="3. Planos Free e Pro">
        <ul style={listStyle}>
          <li>Free: acesso essencial com limitações de jogos, jogadores e métricas.</li>
          <li>Pro: acesso completo aos recursos do produto, com todas as estatísticas liberadas.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Assinatura, cobrança e pagamentos">
        <ul style={listStyle}>
          <li>A assinatura Pro segue o ciclo contratado até cancelamento.</li>
          <li>O processamento de pagamento é realizado pelo Mercado Pago.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Cancelamento">
        <p>O cancelamento pode ser solicitado pela área logada. O acesso Pro permanece ativo até o fim do período já pago, quando aplicável.</p>
      </LegalSection>

      <LegalSection title="6. Uso aceitável e responsabilidades">
        <ul style={listStyle}>
          <li>Manter credenciais em sigilo e sob responsabilidade do titular da conta.</li>
          <li>Não compartilhar acesso pago sem autorização.</li>
          <li>Utilizar a plataforma de forma lícita e em conformidade com estes termos.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Limitação de responsabilidade">
        <p>As informações têm caráter analítico e educacional. O LinhaCash não garante resultados financeiros nem resultados em apostas.</p>
      </LegalSection>

      <LegalSection title="8. Contato">
        <p>Para suporte e assuntos contratuais: contato@linhacash.com.</p>
      </LegalSection>
    </PublicLegalLayout>
  );
}
