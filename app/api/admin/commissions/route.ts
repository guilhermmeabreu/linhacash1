import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminUser } from '@/lib/auth/authorization';
import { AppError } from '@/lib/http/errors';
import { fail, internalError, options } from '@/lib/http/responses';
import { asNumber, asString, ensureObject } from '@/lib/validators/common';
import { getCachedValue, invalidateCacheByPrefix } from '@/lib/cache/memory-cache';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const ALLOWED_STATUSES = new Set(['pending', 'earned', 'paid']);

export async function GET(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  try {
    await requireAdminUser(req);
    const data = await getCachedValue('admin:commissions', 30_000, async () => {
      const { data: rows } = await supabase.from('affiliate_commissions').select('*').order('created_at', { ascending: false });
      return rows || [];
    });
    return NextResponse.json(data || []);
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
    const rawStatus = asString(body.commission_status, 'commission_status', 20).toLowerCase();
    const payoutNote = typeof body.payout_note === 'string' ? body.payout_note.trim().slice(0, 240) : null;
    if (!ALLOWED_STATUSES.has(rawStatus)) {
      return NextResponse.json({ error: 'commission_status inválido' }, { status: 400 });
    }

    const patch: Record<string, unknown> = {
      commission_status: rawStatus,
      payout_note: payoutNote,
      updated_at: new Date().toISOString(),
    };
    if (rawStatus === 'paid') {
      patch.paid_at = new Date().toISOString();
    } else if (body.clear_paid_at === true) {
      patch.paid_at = null;
    }

    await supabase.from('affiliate_commissions').update(patch).eq('id', id);
    invalidateCacheByPrefix('admin:');
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) return fail(error, origin);
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}

