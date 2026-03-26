import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: 'admin_auth',
    value: email,
    httpOnly: true,
    secure: true,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    sameSite: 'none'
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('admin_auth');
  return response;
}
