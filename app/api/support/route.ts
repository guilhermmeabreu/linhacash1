import { createClient } from '@supabase/supabase-js';
import {
  buildBugConfirmationEmail,
  buildBugInternalEmail,
  buildSupportConfirmationEmail,
  buildSupportInternalEmail,
  sendEmailDetailed
} from '@/lib/emails';
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
    const payload = await readJsonObject(req);
    const user = await resolveOptionalUser(req);
    const { type, subject, message } = validateSupportPayload(payload);
    const ip = getIP(req);
    const actorKey = user?.id ? `user:${user.id}` : `ip:${ip}`;
    const limit = type === 'bug' ? 5 : 8;
    const rate = await rateLimitDetailed(`support:${type}:${actorKey}`, limit, 60 * 60_000);
    if (!rate.allowed) {
      logSecurityEvent('route_rate_limited', { ...context, route: '/api/support', retryAfterSeconds: rate.retryAfterSeconds });
      return fail(
        new AppError('RATE_LIMIT_ERROR', 429, `Muitas solicitações. Tente novamente em ${rate.retryAfterSeconds}s.`),
        origin
      );
    }

    logSecurityEvent('support_attempt', { ...context, userId: user?.id || null });
    const name = user?.name || 'Usuário';
    const email = user?.email || null;
    const supportInbox = process.env.SUPPORT_EMAIL || 'suporte@linhacash.com.br';
    const submittedAt = new Date().toISOString();
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'LinhaCash <suporte@linhacash.com.br>';

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

    const emailContext = {
      subject,
      message,
      name,
      email,
      userId: user?.id || null,
      submittedAtISO: submittedAt,
    };
    const internalEmail = type === 'bug'
      ? buildBugInternalEmail(emailContext)
      : buildSupportInternalEmail(emailContext);
    const confirmationEmail = type === 'bug'
      ? buildBugConfirmationEmail(emailContext)
      : buildSupportConfirmationEmail(emailContext);

    logSecurityEvent('support_internal_email_started', {
      ...context,
      userId: user?.id || null,
      to: supportInbox,
      from: fromAddress,
      replyTo: email || null,
      subject: internalEmail.subject,
      type,
      messageLength: message.length,
    });
    const internalDelivery = await sendEmailDetailed(
      supportInbox,
      internalEmail,
      email || undefined
    );
    const internalSent = internalDelivery.ok;

    if (internalSent) {
      logSecurityEvent('support_internal_email_sent', {
        ...context,
        userId: user?.id || null,
        to: supportInbox,
        resendId: internalDelivery.id || null,
        status: internalDelivery.status,
        type
      });
    } else {
      logSecurityEvent('support_internal_email_failed', {
        ...context,
        userId: user?.id || null,
        to: supportInbox,
        status: internalDelivery.status,
        error: internalDelivery.error || null,
        type
      });
    }

    let confirmationSent = false;
    if (email) {
      const confirmationDelivery = await sendEmailDetailed(email, confirmationEmail);
      confirmationSent = confirmationDelivery.ok;
      if (confirmationSent) {
        logSecurityEvent('support_confirmation_email_sent', {
          ...context,
          userId: user?.id || null,
          to: email,
          resendId: confirmationDelivery.id || null,
          status: confirmationDelivery.status,
          type
        });
      } else {
        logSecurityEvent('support_confirmation_email_failed', {
          ...context,
          userId: user?.id || null,
          to: email,
          status: confirmationDelivery.status,
          error: confirmationDelivery.error || null,
          type
        });
      }
    }

    await auditLog('support_message_sent', { userId: user?.id || null, subject, type });

    return ok({
      sent: true,
      deliveries: {
        internal: internalSent,
        confirmation: email ? confirmationSent : false,
      },
    });
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
