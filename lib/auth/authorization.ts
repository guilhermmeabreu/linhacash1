import { createClient } from '@supabase/supabase-js';
import { AuthenticationError, AuthorizationError } from '@/lib/http/errors';
import { requireAdminSession } from '@/lib/auth/admin-session';
import { getBillingState } from '@/lib/services/billing-service';
import { assertAllowedOrigin } from '@/lib/http/request-guards';

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    throw new AuthenticationError('Authentication service unavailable');
  }

  supabaseClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return supabaseClient;
}

export async function requireAuthenticatedUser(req: Request) {
  const supabase = getSupabase();
  assertAllowedOrigin(req);
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) throw new AuthenticationError();

  const token = authHeader.slice(7);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) throw new AuthenticationError();

  const { data: profile } = await supabase.from('profiles').select('id,email,name').eq('id', user.id).single();
  const safeProfile = (profile && typeof profile === 'object'
    ? (profile as { email?: string; name?: string })
    : null);
  const billing = await getBillingState(user.id);

  return {
    id: user.id,
    email: user.email || safeProfile?.email || '',
    name: safeProfile?.name || '',
    plan: billing.hasProAccess ? 'pro' : 'free',
    billing,
  };
}

export async function requireAdminUser(req: Request) {
  assertAllowedOrigin(req);
  const session = await requireAdminSession(req);
  if (session.email !== process.env.ADMIN_EMAIL) throw new AuthorizationError();
  return session;
}

export async function requireProUser(req: Request) {
  const user = await requireAuthenticatedUser(req);
  if (!user.billing.hasProAccess) throw new AuthorizationError('Pro plan required');
  return user;
}

export async function requireCronRequest(req: Request) {
  const headerSecret = req.headers.get('x-cron-secret');
  if (headerSecret && headerSecret === process.env.CRON_SECRET) return { origin: 'cron' as const };

  await requireAdminUser(req);
  return { origin: 'admin' as const };
}
