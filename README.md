# LinhaCash

LinhaCash é uma plataforma de análise de props da NBA orientada por dados. O objetivo é centralizar jogos, jogadores, tendências e métricas derivadas para reduzir trabalho manual e apoiar análises pré-jogo.

## Propósito da plataforma

A plataforma foi construída para oferecer um fluxo estruturado de análise esportiva com:
- dashboard autenticado;
- pipeline de sincronização de dados;
- exploração de métricas por janelas e splits;
- controle de acesso por plano.

## Funcionalidades principais

- **Pipeline NBA**: sincronização server-side de jogos, jogadores, estatísticas e métricas derivadas.
- **Dashboard de análise**: filtros por janela (L5/L10/L20/L30/Season) e contexto por oponente.
- **Autenticação e perfil**: fluxos de conta baseados em Supabase Auth.
- **Assinaturas e cobrança**: checkout Stripe, portal do cliente e reconciliação de acesso por webhook.
- **Operação administrativa**: APIs de overview, usuários, referrals, comissões e logs de sync.
- **Controles de segurança**: validação de assinatura de webhook, rate limit, proteção de endpoints de cron e readiness checks.

## Stack técnica

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Dados/Auth**: Supabase (Postgres + Auth)
- **Pagamentos**: Stripe
- **Cache e rate limit**: Upstash Redis com fallback em memória
- **Observabilidade**: Sentry
- **UI/Estilo**: CSS Modules, estilos globais e componentes reutilizáveis

## Como rodar localmente

### 1) Instalar dependências

```bash
npm install
```

### 2) Configurar variáveis de ambiente

Crie um `.env.local` com base em `docs/env.mock.example` e preencha com os seus próprios valores.

### 3) Iniciar o servidor de desenvolvimento

```bash
npm run dev
```

### 4) Checks opcionais

```bash
npm run lint
npm run security:preflight
```

## Variáveis de ambiente

Não commite segredos reais. Use placeholders localmente e configure segredos reais apenas no provedor de deploy.

Variáveis típicas deste projeto:

- **Supabase**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
- **Auth/Segurança**
  - `JWT_SECRET`
  - `ADMIN_SESSION_SECRET`
  - `ADMIN_TOTP_SECRET`
  - `ENCRYPTION_KEY`
  - `CRON_SECRET`
- **Stripe**
  - `STRIPE_SECRET_KEY`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_PRO_MONTHLY`
  - `STRIPE_PRICE_PRO_ANNUAL`
  - `STRIPE_PRICE_PLAYOFF_PACK`
- **Dados/Infra**
  - `NBA_API_KEY`
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

Consulte `docs/env.mock.example` como template seguro.

## Deploy (visão geral)

A arquitetura de deploy considera:

- **Vercel** para app Next.js e rotas de API;
- **Supabase** para banco de dados e autenticação;
- **Stripe** para checkout, assinaturas e webhooks.

Em produção, configure variáveis no ambiente de deploy (não no Git) e valide segredos de webhook antes de liberar tráfego.

## Estrutura do repositório (alto nível)

```text
app/
  api/                 # Rotas server-side (auth, dados, billing, admin, sync, webhooks)
  app/                 # Área autenticada
  login|signup|...     # Páginas públicas (auth/legal)
components/            # Componentes reutilizáveis de layout/auth/ui
lib/                   # Serviços centrais (sync, billing, segurança, auth, repositórios)
docs/                  # Documentação operacional e exemplos de ambiente
scripts/               # Scripts utilitários e de segurança
public/                # Assets estáticos
```

## Status e roadmap

### Status atual
- Projeto em desenvolvimento ativo.
- Fluxos principais de dados, autenticação, cobrança e administração já implementados.

### Roadmap (alto nível)
- Melhorar cobertura de testes automatizados.
- Evoluir observabilidade e hardening operacional.
- Continuar polimento de UX nos fluxos de análise e operação.

## Nota de segurança

- Não exponha service keys, webhook secrets ou tokens privados em issues/PRs.
- Faça rotação imediata de credenciais em caso de exposição acidental.
- Mantenha `.env*` fora do Git e use gerenciadores de segredo no deploy.

Se você identificar um problema de segurança, reporte de forma privada aos mantenedores.

## Disclaimer

LinhaCash é uma plataforma de análise de dados. **Não é** casa de apostas, bookmaker ou operadora de apostas.
