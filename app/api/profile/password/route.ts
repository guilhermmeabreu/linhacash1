import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateSession, errorResponse, okResponse, corsHeaders } from '@/lib/security';
import { rateLimit, getIP } from '@/lib/rate-limit';

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase env vars are not configured');
  }

  supabaseClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return supabaseClient;
}

const MIN_PASSWORD_LENGTH = 8;

function isStrongPassword(password: string): boolean {
  return /[A-Za-z]/.test(password) && /\d/.test(password);
}

export async function POST(req: Request) {
  const supabase = getSupabase();
  const session = await validateSession(req);
  if (!session.valid || !session.userId || !session.email) {
    return errorResponse('Não autorizado', 401);
  }

  if (!await rateLimit(getIP(req), 5, 60_000)) {
    return errorResponse('Muitas requisições', 429);
  }

  const body = await req.json().catch(() => ({}));
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword || !newPassword) {
    return errorResponse('Preencha os campos de senha', 400);
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH || !isStrongPassword(newPassword)) {
    return errorResponse('A nova senha deve ter ao menos 8 caracteres, incluindo letras e números', 400);
  }

  if (currentPassword === newPassword) {
    return errorResponse('A nova senha deve ser diferente da senha atual', 400);
  }

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: session.email,
    password: currentPassword,
  });

  if (authError) {
    return errorResponse('Senha atual inválida', 400);
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(session.userId, {
    password: newPassword,
  });

  if (updateError) {
    return errorResponse('Não foi possível alterar a senha agora. Tente novamente.', 400);
  }

  return okResponse({ ok: true, message: 'Senha alterada com sucesso.' });
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}
