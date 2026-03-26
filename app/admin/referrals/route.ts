import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkAuth() {
  const cookieStore = await cookies();
  const auth = cookieStore.get('admin_auth');
  return auth?.value === process.env.ADMIN_EMAIL;
}

export async function GET() {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data } = await supabase.from('referral_codes').select('*').order('uses', { ascending: false });
  return NextResponse.json(data || []);
}

export async function POST(req: Request) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { code, influencer_name } = await req.json();
  const { error } = await supabase.from('referral_codes').insert({ code, influencer_name, uses: 0, commission_pct: 25, active: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, active } = await req.json();
  const { error } = await supabase.from('referral_codes').update({ active }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
