# Linha Cash — Análise de Apostas da NBA

Plataforma brasileira de análise estatística da NBA para apostadores. Dados reais, decisões inteligentes, 100% em português.

---

## Sobre o produto

O Linha Cash centraliza tudo que um apostador precisa para analisar props da NBA em um só lugar. Médias por período, splits casa/fora, gráfico jogo a jogo e score de confiança — sem precisar abrir vários sites em inglês.

**Planos:**
- **Gratuito** — 1 jogo por dia, 1 jogador por time, estatística de PTS
- **Pro Mensal** — R$24,90/mês, acesso completo
- **Pro Anual** — R$197,00/ano (equivale a R$16,41/mês)

---

## Stack

- **Framework:** Next.js 16
- **Banco de dados e Auth:** Supabase (RLS ativo em todas as tabelas)
- **Pagamentos:** Mercado Pago (Checkout Pro + Webhooks)
- **Emails transacionais:** Resend
- **Deploy e Cron:** Vercel
- **Rate limiting:** Upstash Redis
- **Monitoramento:** Sentry (opcional)

---

## Funcionalidades

**App (`/app.html`)**
- Login, registro e autenticação Google via Supabase Auth
- Jogos do dia atualizados automaticamente toda manhã
- Lista de jogadores por time com médias e score de confiança
- Detalhe do jogador com gráfico de barras verde/vermelho
- Períodos L5, L10, L20, L30, Casa e Fora
- 9 tipos de stats: PTS, REB, AST, 3PM, P+A, P+R, A+R, FG2A, FG3A
- Ajuste manual da linha de aposta
- Plano Free/Pro com bloqueios visuais
- Checkout Mercado Pago com código de indicação
- Dark/Light mode persistente no Supabase
- Login com Google (OAuth)
- Suporte via email, termos de uso e política de privacidade
- Exclusão de conta e dados (LGPD Art. 18)
- Responsivo mobile e desktop

**Landing (`/landing.html`)**
- Página principal do produto (rota `/` redireciona para cá)
- Apresentação de funcionalidades e planos
- Dark/Light mode
- Links para login e assinatura

**Admin (`/admin`)**
- Acesso restrito por email e senha
- Dark/Light mode
- Dashboard com métricas de usuários e conversão
- Gestão de usuários — dar/remover Pro, reset senha, apagar conta
- Gestão de códigos de indicação de influenciadores
- Histórico de syncs e logs
- Dark/Light mode

---

## Banco de dados

Tabelas principais no Supabase com Row Level Security ativo:

| Tabela | Descrição |
|---|---|
| `profiles` | Usuários, plano, tema e código de indicação |
| `games` | Jogos do dia com logos e horários |
| `players` | Jogadores NBA por time |
| `player_stats` | Estatísticas históricas por jogo |
| `player_metrics` | Médias calculadas L5/L10/L20/Casa/Fora |
| `player_props_cache` | Cache com hit rate calculado |
| `referral_codes` | Códigos de influenciadores |
| `referral_uses` | Rastreamento de uso por código |
| `sync_logs` | Histórico de syncs diários |
| `injuries` | Status de lesões dos jogadores |
| `account_deletions` | Auditoria de exclusões (LGPD) |

---

## Sync de dados

O sync roda automaticamente via cron Vercel todos os dias de manhã no horário de Brasília.

O processo:
1. Busca os jogos do dia na API de estatísticas
2. Converte horários UTC para BRT corretamente
3. Para cada time que joga, busca os jogadores
4. Para cada jogador, busca os últimos jogos
5. Calcula médias L5/L10/L20/Casa/Fora
6. Popula o cache com hit rate e score de confiança
7. Salva log do sync no banco

---

## Segurança

- Row Level Security em todas as tabelas do Supabase
- Chave de serviço do Supabase apenas no servidor, nunca exposta ao frontend
- Verificação de assinatura HMAC nos webhooks do Mercado Pago
- Rate limiting com Redis em todas as rotas de API
- Headers de segurança: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- Bearer token para autenticação do painel admin
- Dados de cartão nunca armazenados — processados direto pelo Mercado Pago

---

## LGPD

- Política de privacidade em `/privacidade`
- Botão de exclusão de conta com confirmação digitada
- Exclusão completa de todos os dados do banco e do Supabase Auth
- Log de exclusões para auditoria
- ON DELETE CASCADE em tabelas relacionadas
- Prazo de resposta a solicitações: 15 dias úteis

---

## Configuração local

Crie um arquivo `.env.local` com as variáveis necessárias. Este arquivo está no `.gitignore` e nunca deve ser commitado.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
NBA_API_KEY=
MP_ACCESS_TOKEN=
MP_WEBHOOK_SECRET=
NEXT_PUBLIC_URL=
ADMIN_EMAIL=
ADMIN_PASSWORD=
RESEND_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
SENTRY_DSN=
```

Todas as variáveis de produção são configuradas diretamente no painel da Vercel em Settings → Environment Variables.

---

## Estrutura do projeto

```
app/
├── admin/
│   ├── page.tsx              # Painel administrativo
│   └── login/page.tsx        # Login do admin
├── api/
│   ├── sync/                 # Sync de dados
│   ├── checkout/             # Criação de pagamento
│   ├── webhook/mp/           # Webhook Mercado Pago
│   ├── support/              # Suporte por email
│   ├── account/delete/       # Exclusão de conta
│   └── admin/                # APIs do painel admin
├── privacidade/page.tsx      # Política de privacidade
└── page.tsx                  # Redireciona para landing
public/
├── app.html                  # Aplicação principal
├── landing.html              # Página de apresentação
├── logo.png
└── manifest.json
lib/
├── emails.ts                 # Templates de email
├── rate-limit.ts             # Rate limiting
└── sentry.ts                 # Monitoramento de erros
scripts/
└── fetchNBA.js               # Script de sync local
```

---

## Deploy

Push na branch `main` dispara deploy automático na Vercel.

---

## Licença

Todos os direitos reservados. Código proprietário — proibido uso, cópia ou distribuição sem autorização expressa.
