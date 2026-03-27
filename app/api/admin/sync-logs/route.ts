import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

function checkAuth(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return false;
  try { const email = Buffer.from(token, 'base64').toString('utf-8').split(':')[0]; return email === process.env.ADMIN_EMAIL; } catch { return false; }
}

export async function GET(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data } = await supabase.from('sync_logs').select('*').order('created_at', { ascending: false }).limit(20);
  return NextResponse.json(data || []);
}
