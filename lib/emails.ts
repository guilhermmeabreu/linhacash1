// ═══════════════════════════════════════════════════════════════════════════
// EMAILS — Templates profissionais LinhaCash
// ═══════════════════════════════════════════════════════════════════════════

const FROM = process.env.RESEND_FROM_EMAIL || 'LinhaCash <onboarding@resend.dev>';
const LOGO_URL = `${process.env.NEXT_PUBLIC_URL || 'https://linhacash.com.br'}/logo.png`;

function base(content: string) {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"/></head>
    <body style="margin:0;padding:0;background:#050505;font-family:'Helvetica Neue',Arial,sans-serif">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 20px">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-top:3px solid #00e676;border-left:1px solid #1a1a1a;border-right:1px solid #1a1a1a;border-bottom:1px solid #1a1a1a">
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
                <a href="${process.env.NEXT_PUBLIC_URL}/privacidade" style="color:#555;text-decoration:none">Política de Privacidade</a> · 
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
    html: base(`
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
    html: base(`
      <h2 style="color:#00e676;font-size:22px;margin:0 0 16px;font-weight:800">Pro ativado, ${name}!</h2>
      <p>Seu plano <strong style="color:#fff">${plan === 'anual' ? 'Pro Anual' : 'Pro Mensal'}</strong> está ativo. Acesso completo desbloqueado.</p>
      <table width="100%" style="background:#111;border-left:3px solid #00e676;padding:16px 20px;margin:20px 0">
        <tr><td>
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#555;letter-spacing:0.08em;text-transform:uppercase">Agora você tem</p>
          <p style="margin:4px 0;color:#ccc">✓ Todos os jogos do dia</p>
          <p style="margin:4px 0;color:#ccc">✓ Todos os jogadores</p>
          <p style="margin:4px 0;color:#ccc">✓ PTS, REB, AST, 3PM, P+A, P+R, A+R, FG2A, FG3A</p>
          <p style="margin:4px 0;color:#ccc">✓ Splits Casa/Fora</p>
          <p style="margin:4px 0;color:#ccc">✓ Médias L5/L10/L20</p>
          <p style="margin:4px 0;color:#ccc">✓ H2H vs adversário</p>
        </td></tr>
      </table>
      <p style="font-size:13px;color:#555">Dúvidas? Responda este email ou acesse <a href="${process.env.NEXT_PUBLIC_URL}/app.html" style="color:#00e676">linhacash.com.br</a></p>
    `)
  };
}

export function emailSuporte(name: string, email: string, subject: string, message: string) {
  return {
    subject: `[Suporte] ${subject} — ${name}`,
    html: base(`
      <h2 style="color:#fff;font-size:18px;margin:0 0 20px;font-weight:800">Nova mensagem de suporte</h2>
      <table width="100%" style="background:#111;border:1px solid #1a1a1a;margin-bottom:16px">
        <tr><td style="padding:12px 16px;border-bottom:1px solid #1a1a1a">
          <span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">De</span><br/>
          <strong style="color:#fff">${name}</strong> &lt;${email}&gt;
        </td></tr>
        <tr><td style="padding:12px 16px">
          <span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Mensagem</span><br/>
          <p style="color:#ccc;margin:8px 0 0">${message.replace(/\n/g, '<br/>')}</p>
        </td></tr>
      </table>
      <p style="font-size:12px;color:#444">Clique em Responder para responder direto para ${email}</p>
    `)
  };
}

export function emailConfirmacaoSuporte(name: string, message: string) {
  return {
    subject: 'Recebemos sua mensagem ✅',
    html: base(`
      <h2 style="color:#fff;font-size:20px;margin:0 0 12px;font-weight:800">Olá, ${name}!</h2>
      <p>Recebemos sua mensagem e responderemos em até <strong style="color:#fff">24 horas</strong>.</p>
      <table width="100%" style="background:#111;border-left:3px solid #555;padding:16px 20px;margin:20px 0">
        <tr><td>
          <p style="margin:0 0 6px;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Sua mensagem</p>
          <p style="color:#aaa;margin:0">${message.replace(/\n/g, '<br/>')}</p>
        </td></tr>
      </table>
      <p style="font-size:13px;color:#555">Equipe LinhaCash 🏀</p>
    `)
  };
}

export function emailNovoAssinante(email: string, plan: string, valor: number, referralCode: string | null) {
  return {
    subject: `⚡ Novo assinante Pro — ${email}`,
    html: base(`
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
    html: base(`
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
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY não configurado');
    return false;
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

    if (!res.ok) {
      const err = await res.text();
      console.error('[Email] Erro Resend:', err);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[Email] Falha ao enviar:', e);
    return false;
  }
}
