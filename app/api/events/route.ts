import { NextResponse } from 'next/server';
import { corsHeaders, getSupabaseServer, validateSession } from '@/lib/security';
import { getIP, rateLimit, rateLimitDetailed } from '@/lib/rate-limit';
import { buildRequestContext, logRouteError, logSecurityEvent } from '@/lib/observability';

const SENSITIVE_KEYS = ['email', 'password', 'token', 'authorization', 'cpf', 'phone', 'document'];
const MAX_EVENT_PAYLOAD_BYTES = 8 * 1024;
const ALLOWED_TOP_LEVEL_KEYS = new Set(['event_name', 'metadata']);

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
  const context = buildRequestContext(req, { route: '/api/events' });
  const ip = getIP(req);
  const requestContentLength = Number(req.headers.get('content-length') || '0');

  try {
    if (!(await rateLimit(`events:${ip}`, 60, 60_000))) {
      logSecurityEvent('route_rate_limited', { ...context, retryAfterSeconds: 60 });
      return NextResponse.json({ error: 'Muitas requisições' }, { status: 429, headers: corsHeaders() });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      const abuseRate = await rateLimitDetailed(`events:abuse:${ip}`, 12, 60 * 60_000);
      console.warn('[events-abuse]', JSON.stringify({ ...context, reason: 'invalid_json_body', ip, abuseAllowed: abuseRate.allowed }));
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400, headers: corsHeaders() });
    }

    const bodyRecord = body as Record<string, unknown>;
    const hasUnknownTopLevelKeys = Object.keys(bodyRecord).some((key) => !ALLOWED_TOP_LEVEL_KEYS.has(key));
    const constrainedBody = {
      event_name: bodyRecord.event_name,
      metadata: bodyRecord.metadata,
    };

    const effectiveSize = requestContentLength > 0 ? requestContentLength : Buffer.byteLength(JSON.stringify(constrainedBody), 'utf8');
    if (effectiveSize > MAX_EVENT_PAYLOAD_BYTES) {
      const abuseRate = await rateLimitDetailed(`events:abuse:${ip}`, 12, 60 * 60_000);
      console.warn('[events-abuse]', JSON.stringify({ ...context, reason: 'payload_too_large', ip, size: effectiveSize, abuseAllowed: abuseRate.allowed }));
      return NextResponse.json({ error: 'Payload muito grande' }, { status: 413, headers: corsHeaders() });
    }

    if (hasUnknownTopLevelKeys) {
      const abuseRate = await rateLimitDetailed(`events:abuse:${ip}`, 12, 60 * 60_000);
      console.warn('[events-abuse]', JSON.stringify({ ...context, reason: 'unknown_top_level_keys', ip, abuseAllowed: abuseRate.allowed }));
    }

    const eventName = String(constrainedBody.event_name || '').trim().slice(0, 120);

    if (!/^[a-z0-9_\-:.]{2,120}$/i.test(eventName)) {
      const abuseRate = await rateLimitDetailed(`events:abuse:${ip}`, 12, 60 * 60_000);
      console.warn('[events-abuse]', JSON.stringify({ ...context, reason: 'invalid_event_name', ip, abuseAllowed: abuseRate.allowed }));
      return NextResponse.json({ error: 'event_name inválido' }, { status: 400, headers: corsHeaders() });
    }

    const metadata = sanitizeMetadata(constrainedBody.metadata);

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
      logRouteError('/api/events', context.requestId, error, { status: 500, userId, ip });
      return NextResponse.json({ error: 'Erro ao salvar evento' }, { status: 500, headers: corsHeaders() });
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders() });
  } catch (error) {
    logRouteError('/api/events', context.requestId, error, { status: 400, ip });
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}
