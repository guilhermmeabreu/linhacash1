import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PublicNav } from '@/app/_components/public-nav';

const plans = [
  {
    name: 'Free',
    price: 'R$0',
    description: 'Perfeito para testar o fluxo e conhecer a leitura de props.',
    features: ['Todos os jogos visíveis na rodada', '1 jogo liberado por dia', '1 jogador por time', 'Acesso parcial às estatísticas'],
    cta: 'Começar no Free',
    href: '/signup',
  },
  {
    name: 'Pro',
    price: 'R$24,90/mês',
    description: 'Leitura completa para quem acompanha NBA todos os dias.',
    features: ['Todos os jogos da rodada', 'Todos os jogadores', 'Todas as estatísticas liberadas', 'Contexto avançado para decisões rápidas'],
    cta: 'Assinar Pro',
    href: '/signup',
    highlight: true,
  },
];

export default function LandingPage() {
  return (
    <main className="lc-landing">
      <PublicNav />

      <section className="lc-hero lc-public-container">
        <p className="lc-kicker">NBA props intelligence</p>
        <h1>Decida mais rápido com contexto real, não com achismo.</h1>
        <p>
          O LinhaCash organiza tendências, linhas e desempenho recente em uma experiência premium para você analisar melhor antes de entrar em uma aposta.
        </p>
        <div className="lc-hero-cta">
          <Link href="/signup">
            <Button size="lg">Criar conta grátis</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="secondary">Entrar</Button>
          </Link>
        </div>
        <small>Sem cartão de crédito · plano gratuito disponível</small>
      </section>

      <section className="lc-public-container lc-feature-grid">
        <article className="lc-surface">
          <h2>Leitura focada em decisão</h2>
          <p>Navegue por jogos e jogadores com menos ruído e mais sinal para o seu processo.</p>
        </article>
        <article className="lc-surface">
          <h2>Contexto rápido por jogador</h2>
          <p>Compare linha, fase recente e desempenho em poucos cliques com visual direto.</p>
        </article>
        <article className="lc-surface">
          <h2>Fluxo consistente no mobile</h2>
          <p>Interface otimizada para desktop e celular, seguindo o mesmo design do novo app shell.</p>
        </article>
      </section>

      <section className="lc-public-container lc-plan-section" id="planos">
        <header>
          <p className="lc-kicker">Planos</p>
          <h2>Escolha seu nível de profundidade</h2>
          <p>Comece grátis e evolua para o Pro quando quiser mais cobertura e mais contexto por jogador.</p>
        </header>
        <div className="lc-plan-grid">
          {plans.map((plan) => (
            <article key={plan.name} className={`lc-surface ${plan.highlight ? 'lc-plan-highlight' : ''}`}>
              <h3>{plan.name}</h3>
              <strong>{plan.price}</strong>
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

      <section className="lc-public-container lc-final-cta">
        <h2>Comece com o essencial. Desbloqueie a visão completa.</h2>
        <p>Seu fluxo de análise continua o mesmo. Agora com uma experiência mais polida e premium.</p>
        <div className="lc-hero-cta">
          <Link href="/signup">
            <Button size="lg">Começar agora</Button>
          </Link>
          <Link href="/app.html">
            <Button size="lg" variant="secondary">Abrir app legado</Button>
          </Link>
        </div>
      </section>

      <footer className="lc-public-footer">
        <div className="lc-public-container">
          <Link href="/" className="lc-brand">
            <Image src="/logo.png" alt="LinhaCash" width={24} height={24} />
            <span>
              Linha<span>Cash</span>
            </span>
          </Link>
          <p>Uso responsável: LinhaCash é uma plataforma informativa e não intermedia apostas.</p>
          <p>
            <Link href="/termos">Termos</Link> · <Link href="/privacidade">Privacidade</Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
