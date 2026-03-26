import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
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
        items: [{ title, quantity: 1, currency_id: 'BRL', unit_price: price }],
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_URL}/app.html?status=success`,
          failure: `${process.env.NEXT_PUBLIC_URL}/app.html?status=failure`,
          pending: `${process.env.NEXT_PUBLIC_URL}/app.html?status=pending`
        },
        auto_return: 'approved',
        notification_url: `${process.env.NEXT_PUBLIC_URL}/api/webhook/mp`
      })
    });

    const data = await res.json();
    if (!data.init_point) {
      console.error('MP error:', data);
      return NextResponse.json({ error: 'Erro ao gerar pagamento' }, { status: 500 });
    }

    return NextResponse.json({ url: data.init_point });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
