import { createClient } from '@supabase/supabase-js';
import { emailConfirmacaoSuporte, emailSuporte, sendEmail } from '@/lib/emails';
import { AppError } from '@/lib/http/errors';
import { fail, internalError, ok, options } from '@/lib/http/responses';
import { getIP, rateLimitDetailed } from '@/lib/rate-limit';
import { validateSupportPayload } from '@/lib/validators/auth-validator';
import { assertAllowedOrigin, readJsonObject } from '@/lib/http/request-guards';
import { auditLog } from '@/lib/services/audit-log-service';
import { buildRequestContext, logRouteError, logSecurityEvent } from '@/lib/observability';

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    throw new AppError('INTERNAL_ERROR', 500, 'Serviço temporariamente indisponível.');
  }

  supabaseClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return supabaseClient;
}

async function resolveOptionalUser(req: Request): Promise<{ id: string; email: string; name: string } | null> {
  const supabase = getSupabase();
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;

  const { data: profile } = await supabase.from('profiles').select('name,email').eq('id', user.id).maybeSingle();
  const safeProfile = (profile && typeof profile === 'object'
    ? (profile as { email?: string; name?: string })
    : null);
  return {
    id: user.id,
    email: user.email || safeProfile?.email || '',
    name: safeProfile?.name || 'Usuário',
  };
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  const context = buildRequestContext(req);
  try {
    const supabase = getSupabase();
    assertAllowedOrigin(req);
    const ip = getIP(req);
    const rate = await rateLimitDetailed(`support:${ip}`, 3, 60 * 60_000);
    if (!rate.allowed) {
      logSecurityEvent('route_rate_limited', { ...context, route: '/api/support', retryAfterSeconds: rate.retryAfterSeconds });
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many support requests'), origin);
    }

    const user = await resolveOptionalUser(req);
    logSecurityEvent('support_attempt', { ...context, userId: user?.id || null });
    const { type, subject, message } = validateSupportPayload(await readJsonObject(req));
    const name = user?.name || 'Usuário';
    const email = user?.email || null;
    const supportInbox = process.env.SUPPORT_EMAIL || 'suporte@linhacash.com.br';
    const subjectPrefix = type === 'bug' ? 'Bug' : 'Suporte';

    const { error: insertError } = await (supabase as any).from('support_messages').insert({
      user_id: user?.id || null,
      email,
      type,
      subject,
      message,
      status: 'open',
    });
    if (insertError) {
      throw new AppError('INTERNAL_ERROR', 500, 'Não foi possível registrar sua mensagem agora.');
    }

    await sendEmail(supportInbox, emailSuporte(name, email || 'não informado', `[${subjectPrefix}] ${subject}`, message), email || undefined);
    if (email) {
      await sendEmail(email, emailConfirmacaoSuporte(name, message));
    }
    await auditLog('support_message_sent', { userId: user?.id || null, subject, type });

    return ok({ sent: true });
  } catch (error) {
    if (error instanceof AppError) return fail(error, origin);
    logRouteError('/api/support', context.requestId, error);
    logSecurityEvent('support_failed', context);
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
