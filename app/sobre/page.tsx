import type { Metadata } from 'next';
import { LegalSection, listStyle, PublicLegalLayout } from '@/app/_components/public-legal-layout';

export const metadata: Metadata = {
  title: 'Sobre o LinhaCash',
  description:
    'Conheça o LinhaCash, plataforma brasileira de análise de dados para props da NBA com estatísticas avançadas, tendências e matchups.',
};

export default function SobrePage() {
  return (
    <PublicLegalLayout title="Sobre o LinhaCash" updatedAt="21 de abril de 2026">
      <LegalSection title="O que é o LinhaCash">
        <p>
          O LinhaCash é uma plataforma brasileira de análise de dados para props da NBA, criada para transformar dados em contexto
          prático para decisões mais inteligentes.
        </p>
      </LegalSection>

      <LegalSection title="Foco da plataforma">
        <ul style={listStyle}>
          <li>Props da NBA com leitura orientada por dados.</li>
          <li>Estatísticas avançadas para avaliação de desempenho individual.</li>
          <li>Tendências recentes para identificar padrões e consistência.</li>
          <li>Matchups em tempo real para entender contexto de cada confronto.</li>
        </ul>
      </LegalSection>
    </PublicLegalLayout>
  );
}
