# Auditoria de Segurança — OWASP Top 10 (2021)

Data da auditoria: 2026-04-21
Escopo: aplicação Next.js (App Router + APIs em `app/api`) e bibliotecas de segurança em `lib/`.

## Metodologia
- Revisão manual de código para cada categoria OWASP Top 10 2021.
- Verificação de controles existentes (autenticação, autorização, validação de entrada, headers, rate-limit, logs).
- Identificação de gaps com severidade (Alta/Média/Baixa) e recomendações.

## Sumário Executivo
- **Achados críticos/altos:** 2
- **Achados médios:** 3
- **Achados baixos:** 4
- **Controles fortes observados:** validação de sessão por token, rate limiting em rotas sensíveis, verificação de assinatura de webhooks, uso de comparações em tempo constante em segredos.

---

## A01:2021 — Broken Access Control

### Situação observada
- Rotas administrativas usam `requireAdminUser` e sessão admin assinada em cookie HTTPOnly.
- Rotas de usuário validam Bearer token via Supabase (`validateSession` / `requireAuthenticatedUser`).

### Riscos
1. **Médio** — Potencial inconsistência de CORS/Origem entre helpers (`lib/security.ts` vs `lib/http/responses.ts`), podendo abrir superfície para chamadas cruzadas indevidas em endpoints legados.
2. **Baixo** — Algumas rotas legadas retornam respostas com helper antigo, dificultando padronização de controles.

### Recomendação
- Consolidar todas as rotas em `lib/http/request-guards.ts` + `lib/http/responses.ts`.
- Descontinuar gradualmente `lib/security.ts` para respostas/CORS.

---

## A02:2021 — Cryptographic Failures

### Situação observada
- Sessão admin assinada por HMAC SHA-256.
- Webhooks com validação HMAC e comparação segura.

### Riscos
1. **Alto** — Segredo de sessão admin aceitava fallback derivado de `ADMIN_PASSWORD` + `SUPABASE_SERVICE_KEY`, reduzindo previsibilidade/isolamento do segredo de sessão.
2. **Médio** — Funções de criptografia simétrica dependem de formato de `ENCRYPTION_KEY` sem validação explícita de tamanho/hex.

### Recomendação
- Exigir `ADMIN_SESSION_SECRET` em produção (hardening aplicado).
- Validar formalmente formato/entropia de `ENCRYPTION_KEY`.

---

## A03:2021 — Injection

### Situação observada
- Uso predominante de SDK Supabase com filtros tipados (baixo risco de SQLi direta).
- Validações em payloads presentes em várias rotas.

### Riscos
1. **Médio** — Entradas de texto livres (suporte) são persistidas/logadas e enviadas por e-mail; embora esperado, exige sanitização contextual na camada de apresentação/admin para evitar XSS refletido/armazenado.

### Recomendação
- Garantir escaping em toda renderização administrativa de campos de usuário (subject/message/metadata).

---

## A04:2021 — Insecure Design

### Situação observada
- Boas práticas de rate-limit e fluxos de autenticação com mensagens genéricas.

### Riscos
1. **Baixo** — Ausência de documentação formal de threat model por fluxo (auth, billing, webhooks, admin).

### Recomendação
- Criar threat model simples por fluxo crítico com abuso cases e controles compensatórios.

---

## A05:2021 — Security Misconfiguration

### Situação observada
- Cabeçalhos de segurança e CSP configurados globalmente.

### Riscos
1. **Alto** — `next.config.ts` populava placeholders para segredos mesmo sem envs reais, podendo mascarar erro de configuração e degradar segurança operacional.
2. **Médio** — CSP permite `'unsafe-inline'` para script/style (tradeoff funcional), aumentando impacto de XSS.

### Recomendação
- Aplicar placeholders apenas fora de produção (hardening aplicado).
- Plano de migração para CSP com nonce/hash.

---

## A06:2021 — Vulnerable and Outdated Components

### Situação observada
- Dependências modernas (Next 16, React 19, Supabase v2).

### Riscos
1. **Médio** — Sem evidência no código de pipeline automatizado de SCA (ex.: `npm audit` CI + policy de bloqueio).

### Recomendação
- Adicionar stage de CI para `npm audit --omit=dev` com baseline e SLA de correção.

---

## A07:2021 — Identification and Authentication Failures

### Situação observada
- Login com rate-limit por IP/e-mail, mensagens anti-enumeração, 2FA opcional no admin.

### Riscos
1. **Baixo** — 2FA admin parece opcional por configuração; em produção deveria ser mandatória para contas privilegiadas.

### Recomendação
- Tornar 2FA obrigatório em produção para admin.

---

## A08:2021 — Software and Data Integrity Failures

### Situação observada
- Webhooks Stripe/MercadoPago com validação de assinatura.

### Riscos
1. **Baixo** — Não há evidência de assinatura/verificação de integridade para artefatos de deploy no repositório (fora do escopo de código app).

### Recomendação
- Documentar cadeia de confiança do deploy (CI/CD attestations, immutability).

---

## A09:2021 — Security Logging and Monitoring Failures

### Situação observada
- Eventos de segurança e erros são logados com contexto e requestId.

### Riscos
1. **Médio** — Falta de política de retenção/classificação de logs no repositório (operacional).

### Recomendação
- Definir política de retenção + alertas para eventos críticos (auth_failed bursts, webhook signature fail, admin_login_failed).

---

## A10:2021 — Server-Side Request Forgery (SSRF)

### Situação observada
- Chamadas outbound majoritariamente para hosts fixos (Supabase, Stripe, MP, Resend).

### Riscos
1. **Baixo** — Construções de URL com origem da requisição existem em alguns fluxos; manter controle estrito para evitar desvio de destino em cenários edge/proxy mal configurados.

### Recomendação
- Preferir allowlist explícita para domínios de callbacks internos.

---

## Correções aplicadas nesta entrega
1. Hardening de segredo de sessão admin em produção com modo estrito (`ADMIN_SESSION_STRICT_SECRET=true`) e alertas de fallback legado.
2. Hardening de build config para não injetar placeholders de segredos em produção (com escape hatch controlado para migração).
3. Obrigatoriedade de 2FA admin em produção por padrão (com escape hatch temporário `ADMIN_ALLOW_PASSWORD_ONLY=true`).
4. Readiness/preflight de segurança com modo estrito opcional (`SECURITY_READINESS_STRICT=true`).

## Próximos passos priorizados
1. **P0 (7 dias):** remover escape hatches temporários (`ADMIN_ALLOW_PASSWORD_ONLY`, `NEXT_BUILD_ALLOW_PLACEHOLDERS`) e revisar CSP (`unsafe-inline`).
2. **P1 (14 dias):** padronizar respostas/CORS em helper único e validar ENCRYPTION_KEY estritamente.
3. **P2 (30 dias):** integrar SCA em CI + política de logs/alertas.

## Acompanhamento operacional
- Consulte o playbook de rollout e acompanhamento em `docs/security-change-rollout-playbook.md`.
