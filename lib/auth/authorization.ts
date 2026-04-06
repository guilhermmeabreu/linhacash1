import { createClient } from '@supabase/supabase-js';
import { AuthenticationError, AuthorizationError } from '@/lib/http/errors';
import { requireAdminSession } from '@/lib/auth/admin-session';
import { getBillingState } from '@/lib/services/billing-service';
import { assertAllowedOrigin } from '@/lib/http/request-guards';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function requireAuthenticatedUser(req: Request) {
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
  const billing = await getBillingState(user.id);

  return {
    id: user.id,
    email: user.email || profile?.email || '',
    name: profile?.name || '',
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
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (authHeader?.startsWith('Bearer ') && cronSecret) {
    const bearerToken = authHeader.slice(7);
    if (bearerToken === cronSecret) return { origin: 'cron' as const };
  }

  await requireAdminUser(req);
  return { origin: 'admin' as const };
}
