import { NextResponse } from 'next/server';
import { rateLimit, getIP } from '@/lib/rate-limit';
import { emailSuporte, sendEmail } from '@/lib/emails';

export async function POST(req: Request) {
  if (!rateLimit(getIP(req), 3, 3600000)) {
    return NextResponse.json({ error: 'Muitas mensagens. Tente novamente em 1 hora.' }, { status: 429 });
  }

  try {
    const { name, email, subject, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Preencha todos os campos.' }, { status: 400 });
    }
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Email inválido.' }, { status: 400 });
    }
    if (message.length > 2000) {
      return NextResponse.json({ error: 'Mensagem muito longa.' }, { status: 400 });
    }

    // Envia para o admin
    const adminEmail = emailSuporte(name, email, subject || 'Sem assunto', message);
    await sendEmail(process.env.ADMIN_EMAIL!, adminEmail, email);

    // Confirmação para o cliente
    await sendEmail(email, {
      subject: 'Recebemos sua mensagem! ✅',
      html: `
        <div style="font-family:Inter,sans-serif;background:#000;color:#fff;padding:40px 20px;max-width:600px;margin:0 auto">
          <div style="text-align:center;margin-bottom:32px">
            <img src="${process.env.NEXT_PUBLIC_URL}/logo.png" width="60" height="60" style="object-fit:contain"><br>
            <span style="font-size:24px;font-weight:800">Linha<span style="color:#00e676">Cash</span></span>
          </div>
          <h2 style="color:#00e676">Olá, ${name}!</h2>
          <p style="color:#ccc">Recebemos sua mensagem e responderemos em até 24 horas.</p>
          <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:20px;margin:20px 0">
            <p style="color:#888;font-size:12px">SUA MENSAGEM</p>
            <p style="color:#fff">${message.replace(/\n/g, '<br>')}</p>
          </div>
          <p style="color:#888;font-size:13px">Equipe LinhaCash 🏀</p>
        </div>
      `
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
