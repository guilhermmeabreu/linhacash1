import { createClient } from '@supabase/supabase-js';
import { rateLimit, getIP } from '@/lib/rate-limit';
import { loginRateLimit, errorResponse, okResponse, sanitizeProfile } from '@/lib/security';
import { getBillingState } from '@/lib/services/billing-service';
import { assertAllowedOrigin, assertJsonRequest } from '@/lib/http/request-guards';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// POST /api/auth — login, registro, google, forgot, session
export async function POST(req: Request) {
  assertAllowedOrigin(req);
  assertJsonRequest(req);
  const ip = getIP(req);
  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  if (action === 'login') {
    const { email, password } = body;
    if (!email || !password) return errorResponse('Email e senha obrigatórios');

    // Rate limit: 5 tentativas por IP e por email em 15 min
    const allowed = await loginRateLimit(ip, email);
    if (!allowed) {
      return errorResponse('Muitas tentativas. Aguarde 15 minutos.', 429);
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      // Nunca revelar se email existe ou não (user enumeration)
      return errorResponse('Email ou senha incorretos', 401);
    }

    // Buscar perfil — sanitizado
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, email, plan, theme')
      .eq('id', data.user.id)
      .single();

    const billing = await getBillingState(data.user.id);
    return okResponse({
      token: data.session?.access_token,
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

    // Rate limit no registro
    if (!await rateLimit(`register:${ip}`, 3, 3600000)) {
      return errorResponse('Muitos cadastros. Aguarde 1 hora.', 429);
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return errorResponse('Erro ao criar conta. Tente novamente.');

    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        name: name.trim().slice(0, 100), // sanitizar comprimento
        email,
        plan: 'free',
        plan_status: 'none',
        plan_source: 'free',
        billing_status: 'none',
        referral_code_used: referralCode || null,
      });

      // Email de boas-vindas via API interna
      await fetch(`${process.env.NEXT_PUBLIC_URL}/api/emails/welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      }).catch(() => {});
    }

    return okResponse({ ok: true, message: 'Verifique seu email para confirmar a conta' });
  }

  // ── GOOGLE OAUTH ───────────────────────────────────────────────────────────
  if (action === 'google') {
    const redirectUrl = `${process.env.NEXT_PUBLIC_URL}/app.html`;
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
    if (!await rateLimit(`forgot:${ip}`, 3, 3600000)) {
      return errorResponse('Muitas tentativas.', 429);
    }

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_URL}/app.html?reset=true`
    });

    // Sempre retornar ok — não revelar se email existe
    return okResponse({ ok: true });
  }

  // ── LOGOUT ─────────────────────────────────────────────────────────────────
  if (action === 'logout') {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      await supabase.auth.admin.signOut(token).catch(() => {});
    }
    return okResponse({ ok: true });
  }

  return errorResponse('Ação inválida');
}

// GET /api/auth — verificar sessão atual e retornar perfil atualizado
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse('Token ausente', 401);
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return errorResponse('Sessão expirada', 401);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email, plan, theme')
    .eq('id', user.id)
    .single();

  const billing = await getBillingState(user.id);
  return okResponse({
    user: sanitizeProfile({ ...(profile || { id: user.id, email: user.email }), plan: billing.hasProAccess ? 'pro' : 'free' }),
    billing,
  });
}
