# 🏀 LinhaCash

Plataforma de análise de props da NBA para apostadores brasileiros.

## 🌐 Links

- **Site:** https://linhacash1.vercel.app
- **Admin:** https://linhacash1.vercel.app/admin

---

## ✅ O que está pronto

- Frontend completo (mobile + desktop)
- Login/registro com Supabase Auth
- Jogos do dia em tempo real
- Jogadores e estatísticas reais
- Médias L5/L10/L20 e splits Casa/Fora
- Plano Free/Pro com bloqueios
- Checkout Mercado Pago
- Webhook MP ativa Pro automaticamente
- Sync automático todo dia às 04h (Brasília)
- Painel Admin completo
- RLS no Supabase
- Cache de métricas (player_props_cache)

---

## 🗄️ Banco de dados (Supabase)

| Tabela | Descrição |
|---|---|
| `profiles` | Usuários e planos |
| `games` | Jogos do dia |
| `players` | Jogadores NBA |
| `player_stats` | Estatísticas históricas |
| `player_metrics` | Médias calculadas |
| `player_props_cache` | Cache otimizado de props |
| `referral_codes` | Códigos de influenciadores |

---

## ⚙️ Variáveis de ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
NBA_API_KEY=
MP_ACCESS_TOKEN=
NEXT_PUBLIC_URL=
ADMIN_EMAIL=
```

---

## 🔄 Sync automático

O cron roda todo dia às **07:00 UTC (04:00 Brasília)**:

```json
{
  "crons": [{ "path": "/api/sync", "schedule": "0 7 * * *" }]
}
```

Para rodar manualmente:
```bash
node scripts/fetchNBA.js
```

Ou pelo browser:
```
https://linhacash1.vercel.app/api/sync
```

---

## 📁 Estrutura do projeto

```
linhacash/
├── app/
│   ├── admin/
│   │   ├── page.tsx          # Painel admin
│   │   └── login/
│   │       └── page.tsx      # Login admin
│   ├── api/
│   │   ├── sync/
│   │   │   └── route.ts      # Cron sync NBA
│   │   ├── checkout/
│   │   │   └── route.ts      # Checkout MP
│   │   ├── webhook/mp/
│   │   │   └── route.ts      # Webhook MP
│   │   └── admin/
│   │       ├── auth/route.ts
│   │       ├── stats/route.ts
│   │       ├── users/route.ts
│   │       └── referrals/route.ts
│   ├── page.tsx              # Redirect para app.html
│   ├── layout.tsx
│   └── globals.css
├── public/
│   └── app.html              # Frontend completo
├── scripts/
│   └── fetchNBA.js           # Script de sync local
├── lib/
│   └── supabase.ts
├── middleware.ts             # Proteção do admin
└── vercel.json               # Cron config
```

---

## 💳 Pagamentos

- **Mensal:** R$24,90/mês
- **Anual:** R$197,00/ano (R$16,41/mês)
- **Taxa MP:** ~5%
- **Comissão influenciadores:** 25% recorrente

---

## 🚀 Próximos passos

- [ ] Comprar domínio linhacash.com.br
- [ ] Configurar email profissional (Resend)
- [ ] Suporte via WhatsApp Business
- [ ] Assinar API Sports Pro ($15/mês)
- [ ] Parcerias com influenciadores

---

## 💰 Break-even

Apenas **4 assinantes Pro** cobrem todos os custos fixos (~R$92/mês).
