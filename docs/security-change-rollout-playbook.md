# Playbook — Acompanhamento de mudanças de segurança

Data: 2026-04-21  
Escopo: hardenings de sessão admin, env/build e auditoria OWASP Top 10 (2021).

## Objetivo

Aplicar melhorias de segurança **sem quebra de produção**, com rollout progressivo, observabilidade e validação operacional.

## Mudanças entregues

1. Auditoria completa OWASP Top 10 (2021) com achados e priorização.
2. Sessão admin:
   - `ADMIN_SESSION_SECRET` priorizado.
   - `ADMIN_SESSION_STRICT_SECRET=true` habilita modo estrito (falha se segredo ausente).
   - `ADMIN_ALLOW_PASSWORD_ONLY=true` é escape hatch temporário para não bloquear login enquanto 2FA não está configurado.
   - fallback legado mantido para compatibilidade, com alerta em produção.
3. Build/config:
   - placeholders só fora de produção por padrão.
   - escape hatch de migração: `NEXT_BUILD_ALLOW_PLACEHOLDERS=true` (com warning).
4. Readiness/preflight:
   - `SECURITY_READINESS_STRICT=true` torna ausência de envs de segurança bloqueante no `/api/ready`.
   - `npm run security:preflight` valida envs obrigatórias/recomendadas antes do deploy.

## Passo a passo recomendado (rollout seguro)

### Fase 1 — Preparação (dia 0)

1. Configurar secret forte para sessão admin:
   - `ADMIN_SESSION_SECRET=<valor aleatório forte>`
   - `ADMIN_TOTP_SECRET=<segredo base32 do TOTP admin>`
   - `ENCRYPTION_KEY=<64 chars hex>`
2. Validar que todos os ambientes (preview/staging/prod) receberam o segredo.
3. Garantir que **não** existe `NEXT_BUILD_ALLOW_PLACEHOLDERS=true` em produção permanente.

### Fase 2 — Deploy compatível (dia 1)

1. Deploy com configuração atual (sem modo estrito).
2. Monitorar logs por:
   - `[SECURITY] ADMIN_SESSION_SECRET ausente em produção...`
   - `[SECURITY] NEXT_BUILD_ALLOW_PLACEHOLDERS=true em produção...`
3. Se houver alertas, corrigir envs e redeploy.

### Fase 3 — Endurecimento final (dia 2–7)

1. Habilitar `ADMIN_SESSION_STRICT_SECRET=true` em produção.
2. Garantir `ADMIN_ALLOW_PASSWORD_ONLY=false` (ou remover variável) para obrigar 2FA admin.
3. Habilitar `SECURITY_READINESS_STRICT=true` após validação dos envs.
4. Rodar smoke tests:
   - login admin
   - leitura de dashboard admin
   - logout admin
5. Confirmar ausência de fallback em logs após 24h.

## Checklist de validação pós-deploy

- [ ] Login admin funcionando.
- [ ] 2FA admin configurado e obrigatório em produção.
- [ ] Sessão admin persistindo por cookie HTTPOnly.
- [ ] Sem erros 500 em `/api/admin/auth`.
- [ ] Sem warnings de fallback de segredo por 24h.
- [ ] Sem uso de placeholders em produção.
- [ ] `npm run security:preflight` retornando sucesso no pipeline.

## Indicadores para acompanhar

1. Taxa de erro (`5xx`) em rotas:
   - `/api/admin/auth`
   - `/api/admin/overview`
2. Eventos de segurança:
   - `admin_login_failed`
   - `auth_failed`
3. Deploy health:
   - readiness/healthcheck
   - ausência de warnings de configuração.

## Plano de rollback

Se houver impacto operacional:

1. Desabilitar `ADMIN_SESSION_STRICT_SECRET` (voltar `false`/remover).
2. Manter `ADMIN_SESSION_SECRET` configurado.
3. Apenas em emergência de build, usar temporariamente `NEXT_BUILD_ALLOW_PLACEHOLDERS=true` e remover após correção dos envs.

## Responsáveis sugeridos

- Plataforma/DevOps: variáveis de ambiente e política de deploy.
- Backend: validação de rotas e monitoramento de segurança.
- Produto/Operações: confirmação de fluxo admin em produção.
