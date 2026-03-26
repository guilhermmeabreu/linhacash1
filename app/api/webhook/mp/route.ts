import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('Webhook MP:', body);

    if (body.type === 'payment') {
      const paymentId = body.data?.id;
      if (!paymentId) return NextResponse.json({ ok: true });

      // Buscar detalhes do pagamento no MP
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      });
      const payment = await res.json();
      console.log('Payment status:', payment.status);

      if (payment.status === 'approved') {
        const email = payment.payer?.email;
        if (email) {
          // Buscar usuário pelo email e atualizar para Pro
          const { data: users } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single();

          if (users) {
            await supabase
              .from('profiles')
              .update({ plan: 'pro' })
              .eq('id', users.id);
            console.log('Usuário atualizado para Pro:', email);
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
