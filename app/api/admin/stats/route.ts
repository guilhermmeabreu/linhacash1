import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminUser } from '@/lib/auth/authorization';
import { AppError } from '@/lib/http/errors';
import { fail, internalError, options } from '@/lib/http/responses';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function GET(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  try {
    await requireAdminUser(req);
    const [profiles, games, players] = await Promise.all([
      supabase.from('profiles').select('plan, created_at, name, email').order('created_at', { ascending: false }),
      supabase.from('games').select('id', { count: 'exact' }),
      supabase.from('players').select('id', { count: 'exact' }),
    ]);
    const total_users = profiles.data?.length || 0;
    const pro_users = profiles.data?.filter((p: any) => p.plan === 'pro').length || 0;
    return NextResponse.json({ total_users, pro_users, free_users: total_users - pro_users, total_games: games.count || 0, total_players: players.count || 0, recent_signups: profiles.data?.slice(0, 10) || [] });
  } catch (error) {
    if (error instanceof AppError) return fail(error, origin);
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
