import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminUser } from '@/lib/auth/authorization';
import { AppError } from '@/lib/http/errors';
import { fail, internalError, options } from '@/lib/http/responses';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function GET(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  try {
    await requireAdminUser(req);
    const { data } = await supabase.from('sync_logs').select('*').order('created_at', { ascending: false }).limit(20);
    return NextResponse.json(data || []);
  } catch (error) {
    if (error instanceof AppError) return fail(error, origin);
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
