import { NextResponse } from 'next/server';
import { corsHeaders, getSupabaseServer, validateSession } from '@/lib/security';
import { getIP, rateLimit } from '@/lib/rate-limit';

const SENSITIVE_KEYS = ['email', 'password', 'token', 'authorization', 'cpf', 'phone', 'document'];

function sanitizeMetadata(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const entries = Object.entries(input as Record<string, unknown>).slice(0, 25);
  const sanitized: Record<string, unknown> = {};

  for (const [keyRaw, value] of entries) {
    const key = keyRaw.trim().slice(0, 64);
    if (!key) continue;
    if (SENSITIVE_KEYS.some((sensitive) => key.toLowerCase().includes(sensitive))) continue;

    if (typeof value === 'string') {
      sanitized[key] = value.slice(0, 256);
      continue;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export async function POST(req: Request) {
  try {
    if (!(await rateLimit(`events:${getIP(req)}`, 60, 60_000))) {
      return NextResponse.json({ error: 'Muitas requisições' }, { status: 429, headers: corsHeaders() });
    }

    const body = await req.json().catch(() => null);
    const eventName = String(body?.event_name || '').trim().slice(0, 120);

    if (!/^[a-z0-9_\-:.]{2,120}$/i.test(eventName)) {
      return NextResponse.json({ error: 'event_name inválido' }, { status: 400, headers: corsHeaders() });
    }

    const metadata = sanitizeMetadata(body?.metadata);

    let userId: string | null = null;
    if (req.headers.get('authorization')?.startsWith('Bearer ')) {
      const session = await validateSession(req);
      if (session.valid) userId = session.userId || null;
    }

    const supabase = getSupabaseServer();
    const { error } = await supabase.from('events').insert({
      user_id: userId,
      event_name: eventName,
      metadata,
      created_at: new Date().toISOString(),
    });

    if (error) {
      return NextResponse.json({ error: 'Erro ao salvar evento' }, { status: 500, headers: corsHeaders() });
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders() });
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}
