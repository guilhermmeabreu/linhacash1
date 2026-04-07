import { NextResponse } from 'next/server';
import { validateSession, errorResponse, okResponse, corsHeaders } from '@/lib/security';
import { rateLimit, getIP } from '@/lib/rate-limit';

const MIN_EMAIL_LENGTH = 5;
const MAX_EMAIL_LENGTH = 254;

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function resolvePublicUrl(req: Request): string {
  const url = new URL(req.url);
  const requestOrigin = `${url.protocol}//${url.host}`;
  if (url.host) return requestOrigin.replace(/\/+$/, '');

  const configured = process.env.NEXT_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return 'https://linhacash.com.br';
}

export async function POST(req: Request) {
  const session = await validateSession(req);
  if (!session.valid || !session.userId || !session.email) {
    return errorResponse('Não autorizado', 401);
  }

  if (!await rateLimit(getIP(req), 5, 60_000)) {
    return errorResponse('Muitas requisições', 429);
  }

  const body = await req.json().catch(() => ({}));
  const newEmail = normalizeEmail(body.email);

  if (newEmail.length < MIN_EMAIL_LENGTH || newEmail.length > MAX_EMAIL_LENGTH || !isValidEmail(newEmail)) {
    return errorResponse('Digite um email válido', 400);
  }

  if (newEmail === session.email.toLowerCase()) {
    return errorResponse('O novo email deve ser diferente do email atual', 400);
  }

  const publicUrl = resolvePublicUrl(req);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return errorResponse('Serviço temporariamente indisponível. Tente novamente.', 503);
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      Authorization: req.headers.get('authorization') || '',
    },
    body: JSON.stringify({
      email: newEmail,
      options: {
        emailRedirectTo: `${publicUrl}/app.html`,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = typeof payload?.msg === 'string' ? payload.msg.toLowerCase() : '';
    if (msg.includes('already')) return errorResponse('Este email já está em uso', 409);
    if (msg.includes('invalid')) return errorResponse('Digite um email válido', 400);
    return errorResponse('Não foi possível atualizar o email agora. Tente novamente.', 400);
  }

  return okResponse({
    ok: true,
    message: 'Solicitação enviada. Verifique seu novo email para confirmar a alteração.',
  });
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}
