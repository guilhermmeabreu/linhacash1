import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminUser } from '@/lib/auth/authorization';
import { AppError } from '@/lib/http/errors';
import { fail, internalError, options } from '@/lib/http/responses';
import { asNumber, asString, ensureObject } from '@/lib/validators/common';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function GET(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  try {
    await requireAdminUser(req);
    const { data } = await supabase.from('referral_codes').select('*').order('uses', { ascending: false });
    return NextResponse.json(data || []);
  } catch (error) {
    if (error instanceof AppError) return fail(error, origin);
    return internalError(origin);
  }
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  try {
    await requireAdminUser(req);
    const body = ensureObject(await req.json());
    const code = asString(body.code, 'code', 20).toUpperCase();
    const influencer_name = asString(body.influencer_name, 'influencer_name', 120);
    await supabase.from('referral_codes').insert({ code, influencer_name, uses: 0, commission_pct: 25, active: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) return fail(error, origin);
    return internalError(origin);
  }
}

export async function PATCH(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  try {
    await requireAdminUser(req);
    const body = ensureObject(await req.json());
    const id = asNumber(body.id, 'id');
    await supabase.from('referral_codes').update({ active: !!body.active }).eq('id', id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) return fail(error, origin);
    return internalError(origin);
  }
}

export async function DELETE(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  try {
    await requireAdminUser(req);
    const body = ensureObject(await req.json());
    const id = asNumber(body.id, 'id');
    await supabase.from('referral_codes').delete().eq('id', id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) return fail(error, origin);
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
