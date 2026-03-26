import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  const { email } = await req.json();
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;

  if (email !== ADMIN_EMAIL) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const cookieStore = cookies();
  cookieStore.set('admin_auth', email, {
    httpOnly: true,
    secure: true,
    maxAge: 60 * 60 * 24 * 7,
    path: '/'
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = cookies();
  cookieStore.delete('admin_auth');
  return NextResponse.json({ ok: true });
}
