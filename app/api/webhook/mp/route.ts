import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { emailProAtivado, emailBoasVindas, sendEmail } from '@/lib/emails';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

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
          const { data: profile } = await supabase
            .from('profiles').select('id, name').eq('email', email).single();

          if (profile) {
            // Atualiza plano
            await supabase.from('profiles')
              .update({ plan: 'pro', referral_code_used: referralCode })
              .eq('id', profile.id);

            // Rastreia código de indicação
            if (referralCode) {
              const { data: refData } = await supabase
                .from('referral_codes').select('uses').eq('code', referralCode).single();
              if (refData) {
                await supabase.from('referral_codes')
                  .update({ uses: (refData.uses || 0) + 1 }).eq('code', referralCode);
              }
              await supabase.from('referral_uses').insert({
                code: referralCode, user_id: profile.id,
                payment_id: String(paymentId), created_at: new Date().toISOString()
              });
            }

            // Email para o cliente
            const clientEmail = emailProAtivado(profile.name || email, plan);
            await sendEmail(email, clientEmail);

            // Notifica admin
            await sendEmail(process.env.ADMIN_EMAIL!, {
              subject: `⚡ Novo assinante Pro! ${email}`,
              html: `<div style="font-family:sans-serif;padding:20px"><h2>Novo assinante Pro!</h2><p><strong>Email:</strong> ${email}</p><p><strong>Plano:</strong> ${plan}</p><p><strong>Valor:</strong> R$${payment.transaction_amount}</p>${referralCode ? `<p><strong>Código:</strong> ${referralCode}</p>` : ''}<p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p></div>`
            });
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
