# 🏀 LinhaCash — README Completo MVP

> Plataforma de análise de props da NBA para apostadores brasileiros.  
> Stack: Next.js 16 · Supabase · Vercel · Mercado Pago · API Sports · Resend

---

## 🌐 Links

| Ambiente | URL |
|---|---|
| Produção | https://linhacash.com.br |
| App | https://linhacash.com.br/app.html |
| GitHub | _(privado)_ |

---

## ✅ O que está pronto (MVP atual)

### 🎨 Frontend (`public/app.html`)
- [x] Login e registro com Supabase Auth real
- [x] Jogos do dia com logos dos times
- [x] Lista de jogadores por jogo
- [x] Detalhe do jogador — médias L5/L10/L20
- [x] Splits Casa/Fora
- [x] Ajuste manual de linha (+/-)
- [x] Plano Free/Pro com bloqueios visuais
- [x] Modal checkout Mercado Pago
- [x] Código de indicação de influenciador
- [x] Cancelamento de assinatura real no banco
- [x] Perfil do usuário com edição
- [x] Suporte e reporte de bug via email real
- [x] FAQ e termos de uso
- [x] Tema claro/escuro
- [x] Layout mobile + desktop responsivo
- [x] Logo transparente verde #00e676
- [x] Favicon configurado
- [x] PWA manifest configurado
- [x] Player props cache sendo lido com fallback
- [x] Sessão persistente via Supabase Auth

### ⚙️ Backend (`app/api/`)

| Rota | Função |
|---|---|
| `GET /api/sync` | Sync diário com fuso horário BR (janela 15h–02:30h BRT) |
| `POST /api/checkout` | Checkout MP com rate limiting e validação |
| `POST /api/webhook/mp` | Ativa Pro + rastreia código + notifica admin |
| `POST /api/support` | Suporte por email com confirmação ao cliente |
| `POST /api/admin/auth` | Login admin com email + senha via Bearer token |
| `GET /api/admin/stats` | Métricas do dashboard |
| `GET/PATCH/DELETE /api/admin/users` | CRUD usuários |
| `GET/POST/PATCH/DELETE /api/admin/referrals` | CRUD códigos de indicação |
| `GET /api/admin/referral-uses` | Rastreamento de quem usou qual código |
| `GET /api/admin/sync-logs` | Histórico de syncs |

### 👨‍💼 Painel Admin (`/admin`)
- [x] Dashboard — total usuários, Pro vs Free, receita, conversão
- [x] Últimos cadastros em tempo real
- [x] Usuários — filtro por plano, busca, dar/remover Pro, reset senha, apagar
- [x] Qual código de indicação cada usuário usou
- [x] Indicações — criar, pausar, ativar, apagar, ver usuários por código
- [x] Receita gerada por influenciador
- [x] Sync manual com logs em tempo real
- [x] Histórico de syncs salvos no banco
- [x] Autenticação — email + senha via Bearer token

### 🗄️ Banco de Dados (Supabase)

| Tabela | Descrição |
|---|---|
| `profiles` | Usuários, planos e código de indicação usado |
| `games` | Jogos do dia com logos e horários |
| `players` | Jogadores NBA por time |
| `player_stats` | Estatísticas históricas por jogo |
| `player_metrics` | Médias calculadas L5/L10/L20/Casa/Fora |
| `player_props_cache` | Cache otimizado com hit rate calculado |
| `referral_codes` | Códigos de influenciadores com comissão e usos |
| `referral_uses` | Rastreamento detalhado por código |
| `sync_logs` | Histórico completo de syncs |

### 🔐 Segurança
- [x] Headers CSP, X-Frame-Options, HSTS
- [x] Rate limiting em memória
- [x] Validação de inputs em todas as APIs
- [x] Bearer token para admin
- [x] Service key nunca exposta ao frontend
- [x] RLS ativo em todas as tabelas do Supabase

### 📧 Emails (Resend)
- [x] Templates profissionais com logo
- [x] Boas-vindas ao cadastrar
- [x] Pro ativado com lista de benefícios
- [x] Suporte com reply direto para o cliente
- [x] Notificação de novo assinante para o admin
- [x] Alerta de erro no sync

### 🔄 Sync
- [x] Fuso horário BR — janela 15h até 02:30h
- [x] Busca 3 dias em UTC para cobertura total
- [x] Remove duplicatas por ID
- [x] Calcula L5/L10/L20/Casa/Fora
- [x] Popula player_props_cache com hit rate
- [x] Salva logs no banco
- [x] Cron Vercel 04:00 BRT todo dia

---

## 📁 Estrutura do Projeto

```
linhacash/
├── app/
│   ├── admin/
│   │   ├── page.tsx              # Painel admin completo
│   │   └── login/page.tsx        # Login admin
│   ├── api/
│   │   ├── sync/route.ts
│   │   ├── checkout/route.ts
│   │   ├── support/route.ts
│   │   ├── webhook/mp/route.ts
│   │   └── admin/
│   │       ├── auth/route.ts
│   │       ├── stats/route.ts
│   │       ├── users/route.ts
│   │       ├── referrals/route.ts
│   │       ├── referral-uses/route.ts
│   │       └── sync-logs/route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── public/
│   ├── app.html                  # Frontend completo (~1.400 linhas)
│   ├── logo.png                  # Logo transparente
│   ├── manifest.json             # PWA manifest
│   └── sw.js                     # Service Worker (desativado)
├── lib/
│   ├── supabase.ts
│   ├── rate-limit.ts
│   ├── emails.ts
│   └── sentry.ts
├── scripts/
│   └── fetchNBA.js
├── next.config.ts                # Headers de segurança
└── vercel.json                   # Cron config
```

---

## 🔑 Variáveis de Ambiente

> ⚠️ **NUNCA commitar valores reais.** Configure todas as variáveis no painel da Vercel em Settings → Environment Variables.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=          # URL do projeto no Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Chave pública (anon key)
SUPABASE_SERVICE_KEY=              # Chave secreta — NUNCA expor no frontend

# API Sports NBA
NBA_API_KEY=                       # Chave da API Sports

# Mercado Pago
MP_ACCESS_TOKEN=                   # Token de acesso produção
MP_WEBHOOK_SECRET=                 # Chave secreta do webhook MP

# App
NEXT_PUBLIC_URL=                   # URL da aplicação (ex: https://linhacash.com.br)

# Admin
ADMIN_EMAIL=                       # Email do administrador
ADMIN_PASSWORD=                    # Senha do painel admin

# Email
RESEND_API_KEY=                    # Chave da API do Resend

# Redis (opcional — rate limiting robusto)
UPSTASH_REDIS_REST_URL=            # URL do banco Redis Upstash
UPSTASH_REDIS_REST_TOKEN=          # Token do Redis Upstash
```

### Como configurar
1. Acessa **vercel.com** → seu projeto → **Settings** → **Environment Variables**
2. Adiciona cada variável com seu valor real
3. Nunca coloque valores reais neste arquivo ou em qualquer arquivo commitado

---

## 💳 Planos

| Plano | Valor | Recursos |
|---|---|---|
| Free | R$0 | 1 jogo/dia, 1 jogador/time, PTS e REB |
| Pro Mensal | R$24,90/mês | Tudo desbloqueado |
| Pro Anual | R$197,00/ano | Tudo + desconto |

Comissão influenciadores: **25% recorrente** nos dois planos.

---

## 💰 Custos Fixos

| Item | Valor |
|---|---|
| API Sports Pro | R$85/mês |
| Domínio linhacash.com.br | ~R$3,30/mês |
| Email Hostinger Premium | R$6,36/mês |
| Vercel | Gratuito |
| Supabase | Gratuito |
| Resend | Gratuito até 3k emails/mês |
| **Total** | **~R$95/mês** |
| **Break-even** | **4 assinantes Pro** |

---

## 🚀 Próximos Passos

### 🔴 Crítico — bloqueia lançamento
- [ ] Assinar API Sports Pro ($15/mês) — todos os 30 times com dados
- [ ] Comprar domínio linhacash.com.br
- [ ] Configurar Resend com domínio próprio
- [ ] Cadastrar afiliado Betano/KTO (R$150-300 por usuário indicado)

### 🟡 Pré-lançamento
- [ ] H2H real com API paga (30min de trabalho)
- [ ] Hit rate visual — ✓✓✗✓✓ em vez de só porcentagem
- [ ] Score de confiança 1-10 na lista de jogadores
- [ ] Filtro/ordenação por stat na lista
- [ ] Dark/Light persistente no Supabase
- [ ] Status de lesão visível na lista (badge GTD/OUT)

### 🟢 Médio prazo
- [ ] Alertas de lesão em tempo real via push notification
- [ ] Twitter automático — post gerado quando jogador GTD/OUT
- [ ] Blog automático — "Melhores props NBA hoje"
- [ ] Busca global de jogadores
- [ ] Favoritos por usuário
- [ ] Comparação de dois jogadores lado a lado
- [ ] Histórico pessoal de apostas
- [ ] Relatório semanal por email para assinantes Pro
- [ ] Pack Playoffs — R$47 acesso único abril-junho
- [ ] Grupo VIP WhatsApp — R$49,90/mês

---

## 🏗️ Roadmap de Escalabilidade

| Fase | Usuários | O que muda |
|---|---|---|
| MVP atual | 0–500 | Nada, funciona perfeitamente |
| Crescimento | 500–2.000 | Upgrade Supabase Pro ($25/mês) |
| Escala | 2.000–10.000 | Redis para cache, Vercel Pro |
| Produto completo | 10.000+ | Refatorar arquitetura, múltiplos esportes |

---

## 📊 Qualidade Atual

| Área | Nota |
|---|---|
| Design/UX | 8/10 |
| Funcionalidade | 5/10 → 8/10 com API paga |
| Segurança | 8/10 |
| Performance | 7/10 |
| Escalabilidade | 7/10 |
| Código | 5/10 |
| Monitoramento | 7/10 |
| **Geral** | **7/10** |

---

## 🏀 Estratégia de Lançamento

**Playoffs NBA — abril 2026**

| Semana | Ação |
|---|---|
| -2 semanas | Conteúdo educativo no Twitter sem vender |
| Lançamento | "50 vagas beta a R$9,90/mês — link na bio" |
| Playoffs | Análise ao vivo todo dia de jogo |
| Outubro | Lançamento oficial com preço cheio |

---

*Última atualização: março 2026*
