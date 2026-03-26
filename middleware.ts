import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;

export async function GET(req: Request) {
  const cookieStore = cookies();
  const adminAuth = cookieStore.get('admin_auth');
  if (!adminAuth || adminAuth.value !== ADMIN_EMAIL) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }
  return NextResponse.next();
}
