import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminUser } from '@/lib/auth/authorization';
import { AppError } from '@/lib/http/errors';
import { fail, internalError, options } from '@/lib/http/responses';
import { asEmail, asEnum, asUUID, ensureObject } from '@/lib/validators/common';
import { auditLog } from '@/lib/services/audit-log-service';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function GET(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  try {
    await requireAdminUser(req);
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const data = (authUsers?.users || []).map((u: any) => profileMap.get(u.id) || {
      id: u.id,
      name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Usuário',
      email: u.email,
      plan: 'free',
      created_at: u.created_at,
      provider: u.app_metadata?.provider || 'email',
    });
    return NextResponse.json(data);
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
    const id = asUUID(body.id, 'id');
    const plan = asEnum(body.plan, 'plan', ['free', 'pro'] as const);
    await supabase.from('profiles').update({ plan }).eq('id', id);
    await auditLog('plan_change', { targetUserId: id, plan });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) return fail(error, origin);
    return internalError(origin);
  }
}

export async function PUT(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  try {
    await requireAdminUser(req);
    const body = ensureObject(await req.json());
    const email = asEmail(body.email);
    await supabase.auth.admin.generateLink({ type: 'recovery', email });
    await auditLog('password_reset', { email });
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
    const id = asUUID(body.id, 'id');
    await supabase.from('profiles').delete().eq('id', id);
    await supabase.auth.admin.deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) return fail(error, origin);
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
