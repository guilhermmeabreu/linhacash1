import { createClient } from '@supabase/supabase-js';
import { rateLimit, getIP, deploymentNamespace, rateLimitDetailed } from '@/lib/rate-limit';
import { hashEmail, loginRateLimit, errorResponse, okResponse, sanitizeProfile } from '@/lib/security';
import { getBillingState } from '@/lib/services/billing-service';
import { assertAllowedOrigin, assertJsonRequest } from '@/lib/http/request-guards';
import { buildRequestContext, logRouteError, logSecurityEvent } from '@/lib/observability';
import { bootstrapSessionFromToken, createReplacementSession, invalidateAllUserSessions } from '@/lib/auth/session-control';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function resolvePublicUrl(req: Request): string {
  const url = new URL(req.url);
  const requestOrigin = `${url.protocol}//${url.host}`;
  if (url.host) return requestOrigin.replace(/\/+$/, '');

  const configured = process.env.NEXT_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return 'https://linhacash.com.br';
}

function isEmailDeliveryError(errorMessage: string): boolean {
  const message = errorMessage.toLowerCase();
  return (
    message.includes('email') &&
    (message.includes('smtp') ||
      message.includes('send') ||
      message.includes('confirmation') ||
      message.includes('provider') ||
      message.includes('resend') ||
      message.includes('domain'))
  );
}

function summarizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { kind: typeof error };
}

// POST /api/auth — login, registro, google, forgot, session
export async function POST(req: Request) {
  const context = buildRequestContext(req, { route: '/api/auth' });
  try {
    assertAllowedOrigin(req);
    assertJsonRequest(req);
    const ip = getIP(req);
    const publicUrl = resolvePublicUrl(req);
    const body = await req.json().catch(() => ({}));
    const { action } = body;
    logSecurityEvent('auth_attempt', { ...context, action: typeof action === 'string' ? action : 'unknown' });

  // ── LOGIN ──────────────────────────────────────────────────────────────────
    if (action === 'login') {
    const { email, password } = body;
    if (!email || !password) return errorResponse('Email e senha obrigatórios');

    // Rate limit: 5 tentativas por IP e por email em 15 min
    const allowed = await loginRateLimit(ip, email);
      if (!allowed) {
        logSecurityEvent('auth_failed', { ...context, action, reason: 'rate_limited' });
      return errorResponse('Muitas tentativas. Aguarde 15 minutos.', 429);
      }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
      // Nunca revelar se email existe ou não (user enumeration)
        logSecurityEvent('auth_failed', { ...context, action, reason: 'invalid_credentials' });
      return errorResponse('Email ou senha incorretos', 401);
      }

    // Buscar perfil — sanitizado
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, email, plan, theme')
      .eq('id', data.user.id)
      .single();

    const billing = await getBillingState(data.user.id);
      const session = await createReplacementSession({ supabase, userId: data.user.id, req });
      logSecurityEvent('auth_success', { ...context, action, userId: data.user.id });
      return okResponse({
      token: data.session?.access_token,
      sessionId: session.sessionId,
      expiresAt: data.session?.expires_at,
      user: sanitizeProfile({ ...(profile || { id: data.user.id, email }), plan: billing.hasProAccess ? 'pro' : 'free' }),
      billing,
    });
    }

  // ── REGISTRO ───────────────────────────────────────────────────────────────
    if (action === 'register') {
    const { name, email, password, referralCode } = body;
    if (!name || !email || !password) return errorResponse('Dados incompletos');
    if (password.length < 6) return errorResponse('Senha muito curta');

    // Rate limit no registro (bucket separado de login/google; mais tolerante em preview)
    const isProduction = process.env.VERCEL_ENV === 'production';
    const registerWindowMs = isProduction ? 60 * 60 * 1000 : 10 * 60 * 1000;
    const namespace = deploymentNamespace();
    const emailHash = hashEmail(email);
    const ipLimit = isProduction ? 5 : 25;
    const emailLimit = isProduction ? 3 : 8;
    const byIpAllowed = await rateLimit(`register:ip:${namespace}:${ip}`, ipLimit, registerWindowMs);
    const byEmailAllowed = await rateLimit(`register:email:${namespace}:${emailHash}`, emailLimit, registerWindowMs);
      if (!byIpAllowed || !byEmailAllowed) {
      const waitMessage = isProduction
        ? 'Muitos cadastros. Aguarde 1 hora.'
        : 'Muitos cadastros. Aguarde alguns minutos.';
      return errorResponse(waitMessage, 429);
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    let createdUser = data.user;
    let confirmationNotice = 'Verifique seu email para confirmar a conta';

    if (error) {
      const fallbackAllowed = !isProduction && isEmailDeliveryError(error.message || '');
      if (!fallbackAllowed) {
        return errorResponse(error.message || 'Erro ao criar conta. Tente novamente.', 400);
      }

      const { data: fallbackData, error: fallbackError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: name.trim().slice(0, 100) },
      });

      if (fallbackError || !fallbackData.user) {
        return errorResponse('Conta criada parcialmente, mas não foi possível concluir o fluxo de confirmação em ambiente de teste. Tente novamente.', 503);
      }

      createdUser = fallbackData.user;
      confirmationNotice = 'Conta criada em modo de teste. A confirmação por email está temporariamente indisponível neste ambiente.';
    }

    if (createdUser) {
      await supabase.from('profiles').upsert({
        id: createdUser.id,
        name: name.trim().slice(0, 100), // sanitizar comprimento
        email,
        plan: 'free',
        plan_status: 'none',
        plan_source: 'free',
        billing_status: 'none',
        referral_code_used: referralCode || null,
      });

      // Email de boas-vindas via API interna
      const welcomeRes = await fetch(`${publicUrl}/api/emails/welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      }).catch(() => {});

      if (!isProduction && welcomeRes && !welcomeRes.ok) {
        confirmationNotice = 'Conta criada. O envio de email está indisponível neste ambiente de teste.';
      }
    }

      return okResponse({ ok: true, message: confirmationNotice });
    }

  // ── GOOGLE OAUTH ───────────────────────────────────────────────────────────
    if (action === 'google') {
    const redirectUrl = `${publicUrl}/app.html?oauth=google`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl }
    });
    if (error) return errorResponse(error.message);
    return okResponse({ url: data.url });
    }

  // ── RECUPERAR SENHA ────────────────────────────────────────────────────────
    if (action === 'forgot') {
    const { email } = body;
    if (!email) return errorResponse('Email obrigatório');

    // Rate limit no forgot
      const forgotRate = await rateLimitDetailed(`forgot:${ip}`, 3, 3600000);
      if (!forgotRate.allowed) {
        logSecurityEvent('route_rate_limited', { ...context, route: '/api/auth:forgot', retryAfterSeconds: forgotRate.retryAfterSeconds });
      return errorResponse('Muitas tentativas.', 429);
      }

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${publicUrl}/app.html?reset=true`
    });

    // Sempre retornar ok — não revelar se email existe
      return okResponse({ ok: true });
    }

  // ── LOGOUT ─────────────────────────────────────────────────────────────────
    if (action === 'logout') {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        await invalidateAllUserSessions({ supabase, userId: user.id, reason: 'logout' }).catch(() => {});
      }
      await supabase.auth.admin.signOut(token).catch(() => {});
    }
      return okResponse({ ok: true });
    }

    if (action === 'logout_all') {
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return errorResponse('Token ausente', 401);
      }
      const token = authHeader.slice(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return errorResponse('Sessão expirada', 401);
      }
      const invalidated = await invalidateAllUserSessions({ supabase, userId: user.id, reason: 'logout_all_devices' });
      await supabase.auth.admin.signOut(token).catch(() => {});
      return okResponse({ ok: true, invalidatedSessions: invalidated.count });
    }

    return errorResponse('Ação inválida');
  } catch (error) {
    logRouteError('/api/auth', context.requestId, error);
    return errorResponse('Falha na autenticação', 500);
  }
}

// GET /api/auth — verificar sessão atual e retornar perfil atualizado
export async function GET(req: Request) {
  const context = buildRequestContext(req, { route: '/api/auth', flow: 'session_get' });
  let stage = 'start';

  try {
    stage = 'token_extract';
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      logSecurityEvent('auth_failed', { ...context, flow: 'session_get', stage, reason: 'missing_bearer_token' });
      return errorResponse('Token ausente', 401);
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      logSecurityEvent('auth_failed', { ...context, flow: 'session_get', stage, reason: 'empty_bearer_token' });
      return errorResponse('Token ausente', 401);
    }
    console.info('[auth:get]', JSON.stringify({ ...context, stage, tokenPresent: true, tokenLength: token.length }));

    stage = 'token_validate';
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) {
      logSecurityEvent('auth_failed', { ...context, flow: 'session_get', stage, reason: 'invalid_or_expired_token' });
      return errorResponse('Sessão expirada', 401);
    }
    console.info('[auth:get]', JSON.stringify({ ...context, stage, userId: user.id }));

    stage = 'session_bootstrap';
    const sessionValidation = await bootstrapSessionFromToken({ supabase, userId: user.id, req });
    if (!sessionValidation.valid) {
      logSecurityEvent('auth_failed', { ...context, flow: 'session_get', stage, userId: user.id, reason: 'session_invalid' });
      return errorResponse('Sessão inválida', 401);
    }
    console.info('[auth:get]', JSON.stringify({ ...context, stage, userId: user.id, bootstrapped: Boolean((sessionValidation as { bootstrapped?: boolean }).bootstrapped) }));

    stage = 'profile_lookup';
    let profile: { id?: string; name?: string | null; email?: string | null; plan?: string | null; theme?: string | null } | null = null;
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, email, plan, theme')
      .eq('id', user.id)
      .single();
    if (profileError) {
      logRouteError('/api/auth', context.requestId, profileError, { stage, userId: user.id, scope: 'profile_lookup_non_fatal' });
    } else {
      profile = profileData;
    }

    stage = 'billing_lookup';
    let billing = null;
    try {
      billing = await getBillingState(user.id);
    } catch (billingError) {
      logRouteError('/api/auth', context.requestId, billingError, { stage, userId: user.id, scope: 'billing_lookup_non_fatal' });
    }

    const normalizedPlan = billing?.hasProAccess ? 'pro' : profile?.plan === 'pro' ? 'pro' : 'free';
    return okResponse({
      sessionId: sessionValidation.sessionId,
      user: sanitizeProfile({ ...(profile || { id: user.id, email: user.email }), plan: normalizedPlan }),
      billing,
    });
  } catch (error) {
    logRouteError('/api/auth', context.requestId, error, { stage, summary: summarizeError(error) });
    return errorResponse('Falha interna ao validar sessão', 500);
  }
}
