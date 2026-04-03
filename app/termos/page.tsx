import type { Metadata } from 'next';
import { LegalSection, listStyle, PublicLegalLayout } from '@/app/_components/public-legal-layout';

export const metadata: Metadata = {
  title: 'Termos de Uso — LinhaCash',
};

export default function TermosPage() {
  return (
    <PublicLegalLayout title="Termos de Uso e Privacidade" updatedAt="3 de abril de 2026">
      <LegalSection title="1. Descrição do serviço">
        <p>O LinhaCash é uma plataforma de análise de dados esportivos. Não somos casa de apostas, não intermediamos apostas e não executamos ordens de aposta.</p>
      </LegalSection>

      <LegalSection title="2. Planos e assinatura">
        <ul style={listStyle}>
          <li>Plano Free: acesso limitado com um jogo liberado por dia e estatísticas PTS + 3PM.</li>
          <li>Plano Pro: acesso completo a jogos, jogadores e estatísticas disponíveis no produto.</li>
          <li>A assinatura é renovada conforme o ciclo contratado até cancelamento.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Uso de dados">
        <ul style={listStyle}>
          <li>Coletamos dados de cadastro, como nome e email, para autenticação e comunicação da conta.</li>
          <li>Também tratamos dados de uso para segurança, melhoria do produto e suporte.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Pagamentos">
        <p>Pagamentos do plano Pro são processados pelo Mercado Pago. Dados de pagamento são tratados pelo provedor de pagamento conforme os termos dele.</p>
      </LegalSection>

      <LegalSection title="5. Isenção de responsabilidade">
        <p>As análises e métricas têm caráter informativo. Não garantimos ganhos, acerto de apostas ou resultados financeiros de qualquer natureza.</p>
      </LegalSection>

      <LegalSection title="6. Responsabilidades do usuário">
        <ul style={listStyle}>
          <li>Manter credenciais de acesso sob sigilo.</li>
          <li>Usar a plataforma de forma lícita e em conformidade com estes termos.</li>
          <li>Não compartilhar acesso pago com terceiros sem autorização.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Cancelamento">
        <p>O cancelamento pode ser solicitado pela área logada. Quando aplicável, o acesso Pro permanece ativo até o fim do período já pago.</p>
      </LegalSection>

      <LegalSection title="8. Contato">
        <p>Para suporte e solicitações: contato@linhacash.com.</p>
      </LegalSection>
    </PublicLegalLayout>
  );
}
