import React from 'react';

interface LegalViewProps {
  type: 'terms' | 'privacy';
}

export function LegalView({ type }: LegalViewProps) {
  const content = type === 'terms' ? {
    title: "Termos de Uso",
    update: "3 de abril de 2026",
    sections: [
      {
        title: "1. Descrição do serviço",
        text: "O LinhaCash é uma plataforma informativa de análise de dados esportivos. Não somos casa de apostas, não intermediamos apostas e não executamos ordens de aposta."
      },
      {
        title: "2. Finalidade da plataforma",
        text: "O conteúdo disponibilizado tem foco em leitura de desempenho, tendências e contexto para apoiar decisões do usuário."
      },
      {
        title: "3. Planos Free e Pro",
        text: "Free: acesso essencial com limitações de jogos, jogadores e métricas. Pro: acesso completo aos recursos do produto, com todas as estatísticas liberadas."
      },
      {
        title: "4. Assinatura, cobrança e pagamentos",
        text: "A assinatura Pro segue o ciclo contratado até cancelamento. O processamento de pagamento é realizado pelo Mercado Pago."
      },
      {
        title: "5. Cancelamento",
        text: "O cancelamento pode ser solicitado pela área logada. O acesso Pro permanece ativo até o fim do período já pago, quando aplicável."
      }
    ]
  } : {
    title: "Política de Privacidade",
    update: "3 de abril de 2026",
    sections: [
      {
        title: "1. Dados coletados",
        text: "Dados de conta e autenticação, como nome, email e identificadores de sessão. Dados de uso e navegação para segurança, estabilidade e evolução do produto. Contexto de assinatura e status de pagamento associado ao plano."
      },
      {
        title: "2. Finalidades do tratamento",
        text: "Operação da conta, login e recuperação de acesso. Prevenção de abuso, monitoramento técnico e suporte ao usuário. Gestão de assinatura e atendimento financeiro."
      },
      {
        title: "3. Pagamentos e contexto financeiro",
        text: "Pagamentos são processados pelo Mercado Pago. O LinhaCash não armazena dados completos de cartão, recebendo apenas os dados necessários para confirmação e gestão da assinatura."
      },
      {
        title: "4. Cookies e armazenamento local",
        text: "Utilizamos armazenamento local e tecnologias equivalentes para manter sessão, preferências de interface (como tema) e funcionamento essencial da experiência."
      }
    ]
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="flex justify-between items-end mb-12 border-b border-border pb-8">
        <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase">{content.title}</h1>
        <p className="text-[10px] font-black text-muted uppercase tracking-widest">Última atualização: {content.update}</p>
      </div>

      <div className="space-y-12">
        {content.sections.map((section, i) => (
          <div key={i} className="relative pl-8">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
            <h2 className="text-xl font-black uppercase mb-4 tracking-tight">{section.title}</h2>
            <p className="text-muted leading-relaxed">{section.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
