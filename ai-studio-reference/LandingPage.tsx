import React from 'react';
import { motion } from 'motion/react';
import { 
  BarChart3, 
  ChevronRight, 
  Zap, 
  Target, 
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-accent selection:text-black">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass h-16 flex items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent flex items-center justify-center">
            <BarChart3 className="text-black w-5 h-5" />
          </div>
          <span className="font-display font-black text-xl tracking-tighter uppercase">
            Linha<span className="text-accent">Cash</span>
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-widest text-muted">
          <a href="#como-funciona" className="hover:text-white transition-colors">Como Funciona</a>
          <a href="#planos" className="hover:text-white transition-colors">Planos</a>
          <button onClick={onStart} className="btn-primary py-2">Entrar</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 md:px-12 min-h-[90vh] flex flex-col justify-center overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,rgba(34,197,94,0.15),transparent_70%)] pointer-events-none" />
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-8xl lg:text-9xl mb-6 leading-[0.9]">
              Veja o que os <br />
              <span className="text-accent underline decoration-4 underline-offset-8">números</span> mostram
            </h1>
            <p className="text-muted text-lg md:text-xl max-w-2xl mx-auto mb-10 font-medium">
              Tendências, desempenho recente e contexto real dos jogadores da NBA. 
              Organizados para você decidir com mais confiança e velocidade.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4">
              <button onClick={onStart} className="btn-primary w-full md:w-auto text-lg px-12 py-5 flex items-center justify-center gap-2">
                Começar Agora <ArrowRight className="w-5 h-5" />
              </button>
              <a href="#planos" className="btn-secondary w-full md:w-auto text-lg px-12 py-5">
                Ver Planos
              </a>
            </div>
            <p className="mt-6 text-xs text-muted font-bold uppercase tracking-widest">
              Sem cartão de crédito · Plano gratuito disponível
            </p>
          </motion.div>
        </div>
      </section>

      {/* Steps Section */}
      <section id="como-funciona" className="py-24 px-6 md:px-12 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-4xl md:text-6xl mb-4">Como Funciona</h2>
            <p className="text-muted text-lg max-w-xl">
              Três passos simples para transformar dados brutos em decisões inteligentes.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-px bg-border">
            {[
              { 
                step: "01", 
                title: "Escolha o Jogo", 
                desc: "Abra os confrontos do dia e entre direto no duelo que quer analisar.",
                icon: Zap
              },
              { 
                step: "02", 
                title: "Analise o Jogador", 
                desc: "Veja os props principais em um dashboard claro, com os dados que realmente importam.",
                icon: Target
              },
              { 
                step: "03", 
                title: "Tome sua Decisão", 
                desc: "Compare linha, fase recente e contexto. Menos dúvida antes de entrar na aposta.",
                icon: CheckCircle2
              }
            ].map((item, i) => (
              <div key={i} className="bg-background p-10 group hover:bg-surface transition-colors">
                <div className="text-accent font-mono font-bold mb-6">{item.step}</div>
                <item.icon className="w-10 h-10 text-white mb-6 group-hover:text-accent transition-colors" />
                <h3 className="text-2xl mb-4">{item.title}</h3>
                <p className="text-muted leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planos" className="py-24 px-6 md:px-12 border-t border-border bg-surface">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl mb-4">Planos</h2>
            <p className="text-muted text-lg">Escolha o nível de análise que faz sentido para você.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div className="border border-border p-10 flex flex-col">
              <h3 className="text-2xl mb-2">Free</h3>
              <div className="text-4xl font-black mb-6">R$ 0</div>
              <p className="text-muted mb-8 text-sm">Ideal para testar a rotina e sentir a experiência do LinhaCash.</p>
              <ul className="space-y-4 mb-10 flex-1">
                {[
                  "Todos os jogos visíveis",
                  "1 jogo liberado por dia",
                  "1 jogador por time",
                  "Métricas PTS + 3PM"
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-accent" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button onClick={onStart} className="btn-secondary w-full">Começar Grátis</button>
            </div>

            {/* Pro Plan */}
            <div className="border-2 border-accent p-10 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-accent text-black text-[10px] font-black px-4 py-1 uppercase tracking-widest">Recomendado</div>
              <h3 className="text-2xl mb-2">Pro</h3>
              <div className="text-4xl font-black mb-1">R$ 24,90</div>
              <div className="text-muted text-xs font-bold uppercase tracking-widest mb-6">Por mês</div>
              <p className="text-muted mb-8 text-sm">Para quem acompanha NBA todos os dias e quer ler props com profundidade.</p>
              <ul className="space-y-4 mb-10 flex-1">
                {[
                  "Todos os jogos da rodada",
                  "Todos os jogadores liberados",
                  "Props e estatísticas completas",
                  "Contexto avançado (H2H, L20)",
                  "Suporte prioritário"
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-accent" />
                    <span className="font-bold">{feature}</span>
                  </li>
                ))}
              </ul>
              <button onClick={onStart} className="btn-primary w-full">Assinar Pro</button>
              <p className="mt-4 text-center text-[10px] text-muted font-bold uppercase tracking-widest">
                Economize 34% no plano anual
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 md:px-12 border-t border-border">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-6 h-6 bg-accent flex items-center justify-center">
                <BarChart3 className="text-black w-4 h-4" />
              </div>
              <span className="font-display font-black text-lg tracking-tighter uppercase">
                Linha<span className="text-accent">Cash</span>
              </span>
            </div>
            <p className="text-muted max-w-sm mb-8">
              Leitura objetiva de estatísticas e props da NBA para decidir melhor antes de apostar.
            </p>
            <div className="flex gap-6 text-xs font-bold uppercase tracking-widest text-muted">
              <a href="#" className="hover:text-white">Termos</a>
              <a href="#" className="hover:text-white">Privacidade</a>
              <a href="mailto:contato@linhacash.com" className="hover:text-white">Contato</a>
            </div>
          </div>
          <div className="flex flex-col justify-end md:items-end">
            <p className="text-[10px] text-muted max-w-xs md:text-right leading-relaxed mb-4">
              Uso responsável: o LinhaCash não é casa de apostas, não intermedia apostas e não garante resultados.
            </p>
            <p className="text-[10px] text-muted font-bold uppercase tracking-widest">
              © 2026 LinhaCash. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
