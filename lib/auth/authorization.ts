import { createClient } from '@supabase/supabase-js';
import { AuthenticationError, AuthorizationError } from '@/lib/http/errors';
import { requireAdminSession } from '@/lib/auth/admin-session';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function requireAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) throw new AuthenticationError();

  const token = authHeader.slice(7);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) throw new AuthenticationError();

  const { data: profile } = await supabase.from('profiles').select('id,email,plan,name').eq('id', user.id).single();
  return {
    id: user.id,
    email: user.email || profile?.email || '',
    name: profile?.name || '',
    plan: profile?.plan || 'free',
  };
}

export async function requireAdminUser(req: Request) {
  const session = await requireAdminSession(req);
  if (session.email !== process.env.ADMIN_EMAIL) throw new AuthorizationError();
  return session;
}

export async function requireProUser(req: Request) {
  const user = await requireAuthenticatedUser(req);
  if (user.plan !== 'pro') throw new AuthorizationError('Pro plan required');
  return user;
}

export async function requireCronRequest(req: Request) {
  const headerSecret = req.headers.get('x-cron-secret');
  if (headerSecret && headerSecret === process.env.CRON_SECRET) return { origin: 'cron' as const };

  await requireAdminUser(req);
  return { origin: 'admin' as const };
}
