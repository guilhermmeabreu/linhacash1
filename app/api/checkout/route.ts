import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { plan } = await req.json();
  const price = plan === 'anual' ? 197.00 : 24.90;
  const title = plan === 'anual' ? 'LinhaCash Pro Anual' : 'LinhaCash Pro Mensal';

  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      items: [{
        title,
        quantity: 1,
        currency_id: 'BRL',
        unit_price: price
      }],
      back_urls: {
        success: 'https://linhacash1.vercel.app/app.html?status=success',
        failure: 'https://linhacash1.vercel.app/app.html?status=failure',
        pending: 'https://linhacash1.vercel.app/app.html?status=pending'
      },
      auto_return: 'approved'
    })
  });

  const data = await res.json();
  return NextResponse.json({ url: data.init_point });
}