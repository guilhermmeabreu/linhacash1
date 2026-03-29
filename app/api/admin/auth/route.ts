import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) return NextResponse.json({ error: 'Servidor mal configurado' }, { status: 500 });

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Retorna token para ser salvo no localStorage
  const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');
  return NextResponse.json({ ok: true, token, email });
}

export async function DELETE() {
  return NextResponse.json({ ok: true });
}
