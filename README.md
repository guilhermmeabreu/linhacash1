# LinhaCash

LinhaCash é um SaaS de análise de props da NBA para leitura pré-jogo orientada por dados. A plataforma centraliza jogos, jogadores e métricas em uma interface única para acelerar decisão e reduzir análise manual.

## Stack real do projeto

- **Frontend/App**: Next.js 16 (App Router), React 19, TypeScript
- **Dados e auth**: Supabase (Postgres + Supabase Auth)
- **Billing**: Stripe (checkout, portal e webhook)
- **Infra de proteção/performance**: Upstash Redis (rate limit, lock distribuído), cache em memória como fallback
- **Dados NBA**: API-SPORTS (pipeline de sincronização server-side)

## Estrutura principal (repositório)

```text
app/
  api/
    games/              # jogos do dia autenticados
    players/            # jogadores por jogo
    metrics/            # métricas por jogador/stat/window/split
    sync/ + sync/run/   # execução do job de sync (cron protegido)
    stripe/
      checkout/         # criação de sessão Stripe
      portal/           # portal de billing
      webhook/          # eventos Stripe e atualização de acesso
    billing/cancel/     # cancelamento de assinatura
    auth/, profile/, account/, support/
    admin/              # endpoints administrativos
lib/
  services/
    nba-sync.ts         # ingestão NBA + upsert em Supabase
    billing-service.ts  # estado de acesso (free/pro)
    referral-service.ts # códigos de indicação
    affiliate-commission-service.ts
  auth/                 # autorização de usuário/admin/cron
  stripe/               # cliente Stripe server-side
  rate-limit.ts         # Upstash Redis + fallback memória
  security.ts           # validação de sessão, helpers seguros
```

## Arquitetura e fluxo de dados

1. Usuário autenticado no Supabase acessa `/app`.
2. O frontend consome rotas internas (`/api/games`, `/api/players`, `/api/metrics`) com `Authorization: Bearer`.
3. APIs consultam Supabase com service role no servidor e aplicam sanitização/rate limit/cache.
4. O job de sync (`/api/sync` ou `/api/sync/run`) busca dados na API-SPORTS e persiste em `games`, `players`, `player_stats` e `player_metrics`.
5. Mudanças de assinatura são processadas pelo webhook Stripe para refletir acesso Pro em `profiles`.

## Pipeline de sincronização NBA

- Job protegido para cron (`requireCronRequest`) e rate limited.
- Lock local + lock distribuído (Upstash NX EX) para evitar execução concorrente.
- Janela de datas: **D-2 até D+3** para capturar rodada recente/próxima.
- Upsert incremental:
  - `games`
  - `players`
  - `player_stats`
  - `player_metrics` (quando não está em mock)
- Invalidação de cache por prefixo (`games:`, `players:`, `metrics:`, `admin:`) após sync.

## Métricas e leitura de props

A API de métricas suporta janelas **L5, L10, L20, L30 e SEASON**, além de filtros por **split (ALL/HOME/AWAY)** e **oponente**. No dashboard, isso é exibido em splits como **L5/L10/L20/L30, Season e H2H**.

Principais mercados disponíveis no backend incluem: `PTS`, `REB`, `AST`, `3PM`, `PA`, `PR`, `PRA`, `AR`, `DD`, `TD`, `STEAL`, `BLOCKS`, `SB`, `FG2A`, `FG3A`.

## Billing (Stripe)

- Checkout: `/api/stripe/checkout`
- Portal do cliente: `/api/stripe/portal`
- Webhook: `/api/stripe/webhook`
- Webhook (alias para produção): `/api/webhooks/stripe`

Variáveis obrigatórias para produção (live):

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_ANNUAL`
- `STRIPE_PRICE_PLAYOFF_PACK`

O webhook valida assinatura Stripe, reconcilia usuário (metadata/customer/email), atualiza estado de plano no `profiles` e trata atribuição de referral/comissão quando aplicável.

## Segurança (base)

- Autenticação por token Supabase em rotas protegidas.
- Controles por plano (free/pro) em métricas e experiência do dashboard.
- Rate limiting por IP/usuário (Upstash com fallback local).
- Proteção de endpoints internos de sync via segredo de cron.
- Verificação de assinatura no webhook Stripe.
- Chaves sensíveis usadas no servidor (ex.: `SUPABASE_SERVICE_KEY`, segredos Stripe/Upstash), sem exposição em respostas públicas.

## Execução local

```bash
npm install
npm run dev
```

Variáveis de ambiente obrigatórias e integrações são lidas em runtime no backend (Supabase, Stripe, API-SPORTS, Upstash, segredos de cron/webhook).
