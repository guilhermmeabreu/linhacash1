import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { emailProAtivado, sendEmail } from '@/lib/emails';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

function verifyMPSignature(req: Request): boolean {
  if (!process.env.MP_WEBHOOK_SECRET) return true;
  const signature = req.headers.get('x-signature') || '';
  const requestId = req.headers.get('x-request-id') || '';
  const parts = signature.split(',');
  const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1];
  const v1 = parts.find(p => p.startsWith('v1='))?.split('=')[1];
  if (!ts || !v1) return false;
  const manifest = `id:${requestId};request-id:${requestId};ts:${ts};`;
  const hmac = crypto.createHmac('sha256', process.env.MP_WEBHOOK_SECRET).update(manifest).digest('hex');
  return hmac === v1;
}

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    if (!verifyMPSignature(req)) {
      console.warn('Webhook MP: assinatura inválida!');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    const body = JSON.parse(bodyText);
    if (body.type === 'payment') {
      const paymentId = body.data?.id;
      if (!paymentId) return NextResponse.json({ ok: true });
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      });
      const payment = await res.json();
      if (payment.status === 'approved') {
        const email = payment.payer?.email;
        const referralCode = payment.metadata?.referral_code || null;
        const plan = payment.transaction_amount >= 197 ? 'anual' : 'mensal';
        if (email) {
          const { data: profile } = await supabase.from('profiles').select('id, name').eq('email', email).single();
          if (profile) {
            await supabase.from('profiles').update({ plan: 'pro', referral_code_used: referralCode }).eq('id', profile.id);
            if (referralCode) {
              const { data: refData } = await supabase.from('referral_codes').select('uses').eq('code', referralCode).single();
              if (refData) await supabase.from('referral_codes').update({ uses: (refData.uses || 0) + 1 }).eq('code', referralCode);
              await supabase.from('referral_uses').insert({ code: referralCode, user_id: profile.id, payment_id: String(paymentId), created_at: new Date().toISOString() });
            }
            await sendEmail(email, emailProAtivado(profile.name || email, plan));
            await sendEmail(process.env.ADMIN_EMAIL!, { subject: `⚡ Novo Pro! ${email}`, html: `<p>Email: ${email}</p><p>Plano: ${plan}</p><p>Valor: R$${payment.transaction_amount}</p>${referralCode ? `<p>Código: ${referralCode}</p>` : ''}` });
          }
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Webhook error:', e);
    return NextResponse.json({ ok: true });
  }
}
