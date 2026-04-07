// ═══════════════════════════════════════════════════════════════════════════
// EMAILS — Templates profissionais LinhaCash
// ═══════════════════════════════════════════════════════════════════════════

const FROM = process.env.RESEND_FROM_EMAIL || 'LinhaCash <suporte@linhacash.com.br>';
const PUBLIC_SITE_URL = (process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.NEXT_PUBLIC_URL || 'https://linhacash.com.br').replace(/\/+$/, '');
const LOGO_URL = `${PUBLIC_SITE_URL}/logo.png`;

type AppEmail = { subject: string; html: string };

type SupportEmailContext = {
  subject: string;
  message: string;
  name: string;
  email?: string | null;
  userId?: string | null;
  submittedAtISO?: string;
};

const DEFAULT_SUPPORT_RESPONSE_WINDOW = '24 horas';

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function nl2br(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br/>');
}

export function getEmailLayout(content: string) {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"/></head>
    <body style="margin:0;padding:0;background:#050505;font-family:'Helvetica Neue',Arial,sans-serif;color:#c6c6c6">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 20px">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid #1a1a1a;border-top:3px solid #00e676">
            <tr><td style="padding:32px 32px 0">
              <img src="${LOGO_URL}" width="36" height="36" style="display:block;margin-bottom:12px"/>
              <span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.02em">Linha<span style="color:#00e676">Cash</span></span>
              <div style="width:32px;height:2px;background:#00e676;margin-top:16px"></div>
            </td></tr>
            <tr><td style="padding:24px 32px 40px;color:#aaa;font-size:15px;line-height:1.7">
              ${content}
            </td></tr>
            <tr><td style="padding:20px 32px;border-top:1px solid #1a1a1a">
              <p style="margin:0;font-size:12px;color:#444">
                LinhaCash — Análise de props da NBA<br/>
                <a href="${PUBLIC_SITE_URL}/termos" style="color:#555;text-decoration:none">Termos de uso</a> · 
                <a href="${PUBLIC_SITE_URL}/privacidade" style="color:#555;text-decoration:none">Política de privacidade</a> ·
                <a href="mailto:suporte@linhacash.com.br" style="color:#555;text-decoration:none">suporte@linhacash.com.br</a>
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

export function emailBoasVindas(name: string) {
  return {
    subject: 'Bem-vindo ao LinhaCash 🏀',
    html: getEmailLayout(`
      <h2 style="color:#fff;font-size:22px;margin:0 0 16px;font-weight:800">Olá, ${name}!</h2>
      <p>Sua conta foi criada com sucesso. Agora você tem acesso às análises de props da NBA.</p>
      <table width="100%" style="background:#111;border-left:3px solid #00e676;padding:16px 20px;margin:20px 0">
        <tr><td>
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#555;letter-spacing:0.08em;text-transform:uppercase">Plano gratuito inclui</p>
          <p style="margin:4px 0;color:#ccc">✓ 1 jogo por dia</p>
          <p style="margin:4px 0;color:#ccc">✓ 1 jogador por time</p>
          <p style="margin:4px 0;color:#ccc">✓ Estatísticas de PTS</p>
        </td></tr>
      </table>
      <p style="background:#00e676;color:#000;padding:12px 20px;font-weight:800;font-size:14px;text-align:center;letter-spacing:0.06em;margin:0">
        ASSINE PRO — R$24,90/MÊS
      </p>
    `)
  };
}

export function emailProAtivado(name: string, plan: string) {
  return {
    subject: '⚡ Plano Pro ativado!',
    html: getEmailLayout(`
      <h2 style="color:#00e676;font-size:22px;margin:0 0 16px;font-weight:800">Pro ativado, ${name}!</h2>
      <p>Seu plano <strong style="color:#fff">${plan === 'anual' ? 'Pro Anual' : 'Pro Mensal'}</strong> está ativo. Acesso completo desbloqueado.</p>
      <table width="100%" style="background:#111;border-left:3px solid #00e676;padding:16px 20px;margin:20px 0">
        <tr><td>
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#555;letter-spacing:0.08em;text-transform:uppercase">Agora você tem</p>
          <p style="margin:4px 0;color:#ccc">✓ Todos os jogos do dia</p>
          <p style="margin:4px 0;color:#ccc">✓ Todos os jogadores</p>
          <p style="margin:4px 0;color:#ccc">✓ PTS, REB, AST, 3PM, P+A, P+R, A+R, FG3A</p>
          <p style="margin:4px 0;color:#ccc">✓ Splits Casa/Fora</p>
          <p style="margin:4px 0;color:#ccc">✓ Médias L5/L10/L20</p>
          <p style="margin:4px 0;color:#ccc">✓ H2H vs adversário</p>
        </td></tr>
      </table>
      <p style="font-size:13px;color:#555">Dúvidas? Responda este email ou acesse <a href="${PUBLIC_SITE_URL}/app.html" style="color:#00e676">linhacash.com.br</a></p>
    `)
  };
}

export function buildSupportInternalEmail(context: SupportEmailContext): AppEmail {
  const sentAt = context.submittedAtISO
    ? new Date(context.submittedAtISO).toLocaleString('pt-BR')
    : new Date().toLocaleString('pt-BR');
  return {
    subject: `LinhaCash • Suporte • ${context.subject}`,
    html: getEmailLayout(`
      <h2 style="color:#fff;font-size:18px;margin:0 0 20px;font-weight:800">Novo ticket de suporte</h2>
      <table width="100%" style="background:#111;border:1px solid #1a1a1a;margin-bottom:16px">
        <tr><td style="padding:12px 16px;border-bottom:1px solid #1a1a1a">
          <span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Tipo</span><br/>
          <strong style="color:#fff">Suporte</strong>
        </td></tr>
        <tr><td style="padding:12px 16px;border-bottom:1px solid #1a1a1a">
          <span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Assunto</span><br/>
          <strong style="color:#fff">${escapeHtml(context.subject)}</strong>
        </td></tr>
        <tr><td style="padding:12px 16px;border-bottom:1px solid #1a1a1a">
          <span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">De</span><br/>
          <strong style="color:#fff">${escapeHtml(context.name)}</strong> &lt;${escapeHtml(context.email || 'não informado')}&gt;
        </td></tr>
        <tr><td style="padding:12px 16px;border-bottom:1px solid #1a1a1a">
          <span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">User ID</span><br/>
          <code style="color:#aaa;font-size:12px">${escapeHtml(context.userId || 'não autenticado')}</code>
        </td></tr>
        <tr><td style="padding:12px 16px;border-bottom:1px solid #1a1a1a">
          <span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Enviado em</span><br/>
          <strong style="color:#fff">${sentAt}</strong>
        </td></tr>
        <tr><td style="padding:12px 16px">
          <span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Mensagem</span><br/>
          <p style="color:#ccc;margin:8px 0 0">${nl2br(context.message)}</p>
        </td></tr>
      </table>
      <p style="font-size:12px;color:#444">Use responder para retornar diretamente ao usuário.</p>
    `)
  };
}

export function buildSupportConfirmationEmail(context: SupportEmailContext): AppEmail {
  return {
    subject: 'Recebemos sua mensagem — LinhaCash',
    html: getEmailLayout(`
      <h2 style="color:#fff;font-size:20px;margin:0 0 12px;font-weight:800">Olá, ${escapeHtml(context.name)}!</h2>
      <p>Recebemos sua mensagem e retornaremos em até <strong style="color:#fff">${DEFAULT_SUPPORT_RESPONSE_WINDOW}</strong>.</p>
      <table width="100%" style="background:#111;border-left:3px solid #00e676;padding:16px 20px;margin:20px 0">
        <tr><td>
          <p style="margin:0 0 6px;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Assunto</p>
          <p style="color:#f1f1f1;margin:0 0 12px;font-weight:600">${escapeHtml(context.subject)}</p>
        </td></tr>
        <tr><td>
          <p style="margin:0 0 6px;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Resumo enviado</p>
          <p style="color:#aaa;margin:0">${nl2br(context.message)}</p>
        </td></tr>
      </table>
      <p style="font-size:13px;color:#555">Equipe LinhaCash</p>
    `)
  };
}

export function buildBugInternalEmail(context: SupportEmailContext): AppEmail {
  const sentAt = context.submittedAtISO
    ? new Date(context.submittedAtISO).toLocaleString('pt-BR')
    : new Date().toLocaleString('pt-BR');
  return {
    subject: `LinhaCash • Bug report • ${context.subject}`,
    html: getEmailLayout(`
      <h2 style="color:#fff;font-size:18px;margin:0 0 20px;font-weight:800">Novo bug report</h2>
      <table width="100%" style="background:#111;border:1px solid #1a1a1a;margin-bottom:16px">
        <tr><td style="padding:12px 16px;border-bottom:1px solid #1a1a1a">
          <span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Tipo</span><br/>
          <strong style="color:#fff">Bug report</strong>
        </td></tr>
        <tr><td style="padding:12px 16px;border-bottom:1px solid #1a1a1a">
          <span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Assunto</span><br/>
          <strong style="color:#fff">${escapeHtml(context.subject)}</strong>
        </td></tr>
        <tr><td style="padding:12px 16px;border-bottom:1px solid #1a1a1a">
          <span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Usuário</span><br/>
          <strong style="color:#fff">${escapeHtml(context.name)}</strong> &lt;${escapeHtml(context.email || 'não informado')}&gt;
        </td></tr>
        <tr><td style="padding:12px 16px;border-bottom:1px solid #1a1a1a">
          <span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">User ID</span><br/>
          <code style="color:#aaa;font-size:12px">${escapeHtml(context.userId || 'não autenticado')}</code>
        </td></tr>
        <tr><td style="padding:12px 16px;border-bottom:1px solid #1a1a1a">
          <span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Timestamp</span><br/>
          <strong style="color:#fff">${sentAt}</strong>
        </td></tr>
        <tr><td style="padding:12px 16px">
          <span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Descrição</span><br/>
          <p style="color:#ccc;margin:8px 0 0">${nl2br(context.message)}</p>
        </td></tr>
      </table>
    `)
  };
}

export function buildBugConfirmationEmail(context: SupportEmailContext): AppEmail {
  return {
    subject: 'Recebemos seu bug report — LinhaCash',
    html: getEmailLayout(`
      <h2 style="color:#fff;font-size:20px;margin:0 0 12px;font-weight:800">Obrigado pelo reporte, ${escapeHtml(context.name)}.</h2>
      <p>Nosso time técnico já recebeu o seu bug report e vamos analisar com prioridade. Retornaremos em até <strong style="color:#fff">${DEFAULT_SUPPORT_RESPONSE_WINDOW}</strong>.</p>
      <table width="100%" style="background:#111;border-left:3px solid #00e676;padding:16px 20px;margin:20px 0">
        <tr><td>
          <p style="margin:0 0 6px;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Assunto</p>
          <p style="color:#f1f1f1;margin:0 0 12px;font-weight:600">${escapeHtml(context.subject)}</p>
        </td></tr>
        <tr><td>
          <p style="margin:0 0 6px;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Resumo enviado</p>
          <p style="color:#aaa;margin:0">${nl2br(context.message)}</p>
        </td></tr>
      </table>
      <p style="font-size:13px;color:#555">Seguimos à disposição no suporte oficial da LinhaCash.</p>
    `)
  };
}

// Compatibilidade com os pontos atuais do app.
export function emailSuporte(name: string, email: string, subject: string, message: string) {
  return buildSupportInternalEmail({ name, email, subject, message });
}

export function emailConfirmacaoSuporte(name: string, message: string) {
  return buildSupportConfirmationEmail({ name, subject: 'Suporte LinhaCash', message });
}

export function emailNovoAssinante(email: string, plan: string, valor: number, referralCode: string | null) {
  return {
    subject: `⚡ Novo assinante Pro — ${email}`,
    html: getEmailLayout(`
      <h2 style="color:#00e676;font-size:20px;margin:0 0 20px;font-weight:800">Novo assinante Pro!</h2>
      <table width="100%" style="background:#111;border:1px solid #1a1a1a">
        <tr><td style="padding:12px 16px;border-bottom:1px solid #1a1a1a">
          <span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Email</span><br/>
          <strong style="color:#fff">${email}</strong>
        </td></tr>
        <tr><td style="padding:12px 16px;border-bottom:1px solid #1a1a1a">
          <span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Plano</span><br/>
          <strong style="color:#fff">${plan}</strong>
        </td></tr>
        <tr><td style="padding:12px 16px;border-bottom:1px solid #1a1a1a">
          <span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Valor</span><br/>
          <strong style="color:#00e676">R$ ${valor.toFixed(2).replace('.', ',')}</strong>
        </td></tr>
        ${referralCode ? `<tr><td style="padding:12px 16px;border-bottom:1px solid #1a1a1a">
          <span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Código indicação</span><br/>
          <strong style="color:#fff;font-family:monospace">${referralCode}</strong>
        </td></tr>` : ''}
        <tr><td style="padding:12px 16px">
          <span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Data</span><br/>
          <strong style="color:#fff">${new Date().toLocaleString('pt-BR')}</strong>
        </td></tr>
      </table>
    `)
  };
}

export function emailExclusaoConta(email: string, userId: string) {
  return {
    subject: '🗑️ Conta excluída — LGPD',
    html: getEmailLayout(`
      <h2 style="color:#fff;font-size:18px;margin:0 0 16px;font-weight:800">Solicitação de exclusão</h2>
      <p>Um usuário solicitou exclusão de conta e dados conforme LGPD Art. 18.</p>
      <table width="100%" style="background:#111;border:1px solid #1a1a1a;margin:16px 0">
        <tr><td style="padding:12px 16px;border-bottom:1px solid #1a1a1a">
          <span style="font-size:11px;color:#555;text-transform:uppercase">Email</span><br/>
          <strong style="color:#fff">${email}</strong>
        </td></tr>
        <tr><td style="padding:12px 16px;border-bottom:1px solid #1a1a1a">
          <span style="font-size:11px;color:#555;text-transform:uppercase">ID</span><br/>
          <code style="color:#aaa;font-size:12px">${userId}</code>
        </td></tr>
        <tr><td style="padding:12px 16px">
          <span style="font-size:11px;color:#555;text-transform:uppercase">Data</span><br/>
          <strong style="color:#fff">${new Date().toLocaleString('pt-BR')}</strong>
        </td></tr>
      </table>
      <p style="font-size:13px;color:#555">Todos os dados foram excluídos automaticamente do banco e do Supabase Auth.</p>
    `)
  };
}

export async function sendEmail(
  to: string,
  emailData: { subject: string; html: string },
  replyTo?: string
): Promise<boolean> {
  const result = await sendEmailDetailed(to, emailData, replyTo);
  return result.ok;
}

export type EmailSendResult = {
  ok: boolean;
  status: number;
  id?: string;
  error?: string;
};

export async function sendEmailDetailed(
  to: string,
  emailData: { subject: string; html: string },
  replyTo?: string
): Promise<EmailSendResult> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY não configurado');
    return { ok: false, status: 0, error: 'RESEND_API_KEY_NOT_CONFIGURED' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM,
        to,
        reply_to: replyTo,
        subject: emailData.subject,
        html: emailData.html
      })
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = typeof payload?.message === 'string' ? payload.message : JSON.stringify(payload || {});
      console.error('[Email] Erro Resend:', err);
      return { ok: false, status: res.status, error: err };
    }

    return { ok: true, status: res.status, id: typeof payload?.id === 'string' ? payload.id : undefined };
  } catch (e) {
    console.error('[Email] Falha ao enviar:', e);
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'UNKNOWN_EMAIL_ERROR' };
  }
}
