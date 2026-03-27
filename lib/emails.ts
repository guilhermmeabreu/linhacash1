const LOGO_URL = `${process.env.NEXT_PUBLIC_URL}/logo.png`;

const baseStyle = `
  font-family: Inter, sans-serif;
  background: #000;
  color: #fff;
  padding: 40px 20px;
  max-width: 600px;
  margin: 0 auto;
`;

const headerHtml = `
  <div style="text-align:center;margin-bottom:32px">
    <img src="${LOGO_URL}" width="60" height="60" style="object-fit:contain;margin-bottom:12px"><br>
    <span style="font-size:24px;font-weight:800;color:#fff">Linha<span style="color:#00e676">Cash</span></span>
  </div>
`;

const footerHtml = `
  <div style="text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #2a2a2a">
    <p style="font-size:12px;color:#888">LinhaCash — Análise de props da NBA</p>
    <p style="font-size:12px;color:#888">Dúvidas? Responda este email.</p>
  </div>
`;

export function emailBoasVindas(name: string) {
  return {
    subject: 'Bem-vindo ao LinhaCash! 🏀',
    html: `
      <div style="${baseStyle}">
        ${headerHtml}
        <h2 style="color:#00e676;margin-bottom:8px">Bem-vindo, ${name}!</h2>
        <p style="color:#ccc;margin-bottom:16px">Sua conta foi criada com sucesso. Agora você tem acesso às análises de props da NBA.</p>
        <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:20px;margin-bottom:20px">
          <p style="color:#888;font-size:13px;margin-bottom:8px">COM O PLANO GRATUITO VOCÊ TEM:</p>
          <p style="color:#fff">✓ 1 jogo por dia</p>
          <p style="color:#fff">✓ 1 jogador por time</p>
          <p style="color:#fff">✓ Stats de PTS e REB</p>
        </div>
        <div style="background:rgba(0,230,118,.1);border:1px solid rgba(0,230,118,.3);border-radius:12px;padding:20px">
          <p style="color:#00e676;font-weight:700;margin-bottom:8px">⚡ QUER ACESSO COMPLETO?</p>
          <p style="color:#ccc;font-size:13px">Assine o Plano Pro por apenas R$24,90/mês e tenha acesso a todos os jogos, jogadores e estatísticas.</p>
        </div>
        ${footerHtml}
      </div>
    `
  };
}

export function emailProAtivado(name: string, plan: string) {
  return {
    subject: '⚡ Plano Pro ativado! Bem-vindo ao LinhaCash Pro',
    html: `
      <div style="${baseStyle}">
        ${headerHtml}
        <h2 style="color:#00e676;margin-bottom:8px">Plano Pro ativado! ⚡</h2>
        <p style="color:#ccc;margin-bottom:16px">Parabéns, ${name}! Seu plano <strong style="color:#00e676">${plan === 'anual' ? 'Pro Anual' : 'Pro Mensal'}</strong> está ativo.</p>
        <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:20px;margin-bottom:20px">
          <p style="color:#888;font-size:13px;margin-bottom:8px">AGORA VOCÊ TEM ACESSO A:</p>
          <p style="color:#fff">✓ Todos os jogos do dia</p>
          <p style="color:#fff">✓ Todos os jogadores</p>
          <p style="color:#fff">✓ PTS, REB, AST, 3PM, P+A, P+R</p>
          <p style="color:#fff">✓ Splits Casa/Fora</p>
          <p style="color:#fff">✓ Médias L5/L10/L20</p>
          <p style="color:#fff">✓ H2H vs adversário</p>
        </div>
        ${footerHtml}
      </div>
    `
  };
}

export function emailSuporte(name: string, email: string, subject: string, message: string) {
  return {
    subject: `[Suporte] ${subject} - ${name}`,
    html: `
      <div style="${baseStyle}">
        ${headerHtml}
        <h2 style="color:#fff;margin-bottom:16px">Nova mensagem de suporte</h2>
        <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:20px;margin-bottom:16px">
          <p style="color:#888;font-size:12px">DE</p>
          <p style="color:#fff;font-weight:600">${name}</p>
          <p style="color:#888">${email}</p>
        </div>
        <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:20px">
          <p style="color:#888;font-size:12px">MENSAGEM</p>
          <p style="color:#fff">${message.replace(/\n/g, '<br>')}</p>
        </div>
        <p style="color:#888;font-size:12px;margin-top:16px">Clique em Responder para responder direto para ${email}</p>
        ${footerHtml}
      </div>
    `
  };
}

export async function sendEmail(to: string, emailData: { subject: string; html: string }, replyTo?: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY não configurado — email não enviado');
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'LinhaCash <onboarding@resend.dev>',
      to,
      reply_to: replyTo,
      subject: emailData.subject,
      html: emailData.html
    })
  });

  if (!res.ok) {
    console.error('Erro ao enviar email:', await res.text());
  }
}
