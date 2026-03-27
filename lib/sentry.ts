// Sentry para monitoramento de erros em produção
// Para ativar: npm install @sentry/nextjs e configurar SENTRY_DSN nas env vars

export function captureError(error: Error | unknown, context?: Record<string, any>) {
  const err = error instanceof Error ? error : new Error(String(error));
  
  // Log sempre no console
  console.error('[LinhaCash Error]', err.message, context || '');

  // Se Sentry estiver configurado, envia para lá
  if (process.env.SENTRY_DSN) {
    try {
      // @ts-ignore
      const Sentry = require('@sentry/nextjs');
      if (context) Sentry.setContext('extra', context);
      Sentry.captureException(err);
    } catch (e) {
      console.error('Sentry não configurado:', e);
    }
  }

  // Notifica admin via Resend se for erro crítico
  if (process.env.RESEND_API_KEY && context?.critical) {
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'LinhaCash Sistema <onboarding@resend.dev>',
        to: process.env.ADMIN_EMAIL,
        subject: '🚨 Erro crítico no LinhaCash',
        html: `<h2>Erro crítico detectado</h2><p><strong>Erro:</strong> ${err.message}</p><pre>${err.stack}</pre><p><strong>Contexto:</strong> ${JSON.stringify(context, null, 2)}</p><p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>`
      })
    }).catch(console.error);
  }
}
