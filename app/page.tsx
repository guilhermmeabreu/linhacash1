import Link from 'next/link';
import { ArrowDown, ArrowRight, CheckCircle2, Target, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicNav } from '@/app/_components/public-nav';
import { LinhaCashLogo } from '@/components/layout';
import { ContextualLegalLinks } from '@/app/_components/contextual-legal-links';

const plans = [
  {
    name: 'Free',
    price: 'R$0',
    period: '',
    description: 'Ideal para testar o fluxo e sentir a experiência do LinhaCash.',
    features: ['Todos os jogos visíveis', '1 jogo liberado por dia', '1 jogador por time', 'Métricas PTS + 3PM'],
    cta: 'Começar grátis',
    href: '/signup',
  },
  {
    name: 'Pro',
    price: 'R$24,90',
    period: '/mês',
    annualPrice: 'R$197/ano',
    description: 'Para quem acompanha NBA todos os dias e quer leitura completa de props.',
    features: ['Todos os jogos da rodada', 'Todos os jogadores liberados', 'Props e estatísticas completas', 'Contexto avançado (H2H, L20)'],
    cta: 'Assinar Pro',
    href: '/signup',
    highlight: true,
  },
];

const steps = [
  {
    step: '01',
    title: 'Escolha o Jogo',
    description: 'Abra os confrontos do dia e entre direto no duelo que quer analisar.',
    icon: Zap,
  },
  {
    step: '02',
    title: 'Analise o Jogador',
    description: 'Veja os props principais com os dados que realmente importam.',
    icon: Target,
  },
  {
    step: '03',
    title: 'Tome sua Decisão',
    description: 'Compare linha, fase recente e contexto antes de apostar.',
    icon: CheckCircle2,
  },
];

export default function LandingPage() {
  return (
    <main className="lc-landing">
      <PublicNav />

      <section className="lc-hero lc-public-container" id="hero">
        <div className="lc-hero-content">
          <h1>
            Decida com vantagem.<br />
            <span>Dados acionáveis em segundos.</span>
          </h1>
          <p>
            Tendências, desempenho recente e contexto real dos jogadores da NBA em uma leitura objetiva para agir com mais confiança.
          </p>
          <div className="lc-hero-cta">
            <Link href="/signup">
              <Button size="lg">Começar grátis <ArrowRight size={18} /></Button>
            </Link>
            <a href="#planos" className="lc-hero-secondary-cta">
              <Button variant="secondary" size="lg">Ver planos</Button>
            </a>
          </div>
          <small>Sem cartão de crédito · plano gratuito disponível</small>
          <a className="lc-scroll-hint" href="#como-funciona" aria-label="Ver mais conteúdo">
            <ArrowDown size={16} />
            <span>Role para ver mais</span>
          </a>
        </div>
      </section>

      <section id="como-funciona" className="lc-public-container lc-step-section">
        <header>
          <h2>Como funciona</h2>
          <p>Três passos simples para transformar dados em decisões inteligentes.</p>
        </header>
        <div className="lc-step-grid">
          {steps.map((item) => (
            <article key={item.step} className="lc-surface">
              <span>{item.step}</span>
              <item.icon size={32} />
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lc-public-container lc-plan-section" id="planos">
        <header>
          <h2>Planos</h2>
          <p>Escolha o nível de análise que faz sentido para você.</p>
        </header>
        <div className="lc-plan-grid">
          {plans.map((plan) => (
            <article key={plan.name} className={`lc-surface ${plan.highlight ? 'lc-plan-highlight' : ''}`}>
              {plan.highlight ? <div className="lc-plan-pill">Melhor escolha</div> : null}
              <h3>{plan.name}</h3>
              <strong>{plan.price}{plan.period ? <small>{plan.period}</small> : null}</strong>
              {'annualPrice' in plan ? (
                <p className="lc-plan-annual-inline">R$ 197/ano <span>· R$ 16,41/mês no anual</span></p>
              ) : null}
              <p>{plan.description}</p>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <Link href={plan.href}>
                <Button variant={plan.highlight ? 'primary' : 'secondary'}>{plan.cta}</Button>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <footer className="lc-public-footer">
        <div className="lc-public-container">
          <div className="lc-public-footer-brand">
            <LinhaCashLogo href="/" ariaLabel="LinhaCash home" />
            <p>Plataforma premium de leitura objetiva para props da NBA.</p>
          </div>
          <ContextualLegalLinks className="lc-public-footer-links" includeSupport />
          <p className="lc-public-footer-note">Uso responsável: o LinhaCash não é casa de apostas e não intermedia apostas.</p>
        </div>
      </footer>
    </main>
  );
}
