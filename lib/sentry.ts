// ═══════════════════════════════════════════════════════════════════════════
// SENTRY — Monitoramento de erros em produção
// ═══════════════════════════════════════════════════════════════════════════
//
// COMO ATIVAR:
// 1. Cria conta gratuita em sentry.io
// 2. Cria projeto "Next.js"
// 3. Copia o DSN
// 4. Adiciona na Vercel: SENTRY_DSN=https://xxx@sentry.io/xxx
// 5. npm install @sentry/nextjs
//
// Sem configuração funciona como logger + alerta por email.
// ═══════════════════════════════════════════════════════════════════════════

type ErrorContext = {
  critical?: boolean;
  userId?: string;
  route?: string;
  action?: string;
  [key: string]: any;
};

export async function captureError(
  error: Error | unknown,
  context?: ErrorContext
) {
  const err = error instanceof Error ? error : new Error(String(error));
  const ctx = context || {};

  // 1. Log no console sempre
  console.error('[LinhaCash Error]', {
    message: err.message,
    stack: err.stack,
    ...ctx,
    timestamp: new Date().toISOString()
  });

  // 2. Sentry se configurado
  if (process.env.SENTRY_DSN) {
    try {
      const Sentry = await import('@sentry/nextjs');
      Sentry.withScope((scope: any) => {
        if (ctx.userId) scope.setUser({ id: ctx.userId });
        if (ctx.route) scope.setTag('route', ctx.route);
        if (ctx.action) scope.setTag('action', ctx.action);
        scope.setContext('extra', ctx);
        Sentry.captureException(err);
      });
    } catch (e) {
      // Sentry não instalado — silencioso
    }
  }

  // 3. Alerta por email para erros críticos
  if (process.env.RESEND_API_KEY && ctx.critical) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'LinhaCash Sistema <onboarding@resend.dev>',
          to: process.env.ADMIN_EMAIL,
          subject: `🚨 Erro crítico — ${ctx.route || 'LinhaCash'}`,
          html: `
            <h2 style="color:#ff3d3d">Erro crítico detectado</h2>
            <p><strong>Rota:</strong> ${ctx.route || 'N/A'}</p>
            <p><strong>Ação:</strong> ${ctx.action || 'N/A'}</p>
            <p><strong>Usuário:</strong> ${ctx.userId || 'N/A'}</p>
            <p><strong>Erro:</strong> ${err.message}</p>
            <pre style="background:#111;color:#eee;padding:12px;font-size:11px">${err.stack || ''}</pre>
            <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
          `
        })
      });
    } catch (e) {
      console.error('Falha ao enviar alerta de erro:', e);
    }
  }
}

// Helper para erros de API
export function apiError(route: string, error: unknown, userId?: string) {
  return captureError(error, { route, critical: true, userId });
}

// Helper para erros de sync
export function syncError(action: string, error: unknown) {
  return captureError(error, { action, route: '/api/sync', critical: true });
}
