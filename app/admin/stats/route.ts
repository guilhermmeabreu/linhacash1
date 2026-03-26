import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

function checkAuth() {
  const cookieStore = cookies();
  const auth = cookieStore.get('admin_auth');
  return auth?.value === process.env.ADMIN_EMAIL;
}

export async function GET() {
  if (!checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [profiles, games, players] = await Promise.all([
    supabase.from('profiles').select('plan'),
    supabase.from('games').select('id', { count: 'exact' }),
    supabase.from('players').select('id', { count: 'exact' })
  ]);

  const total_users = profiles.data?.length || 0;
  const pro_users = profiles.data?.filter(p => p.plan === 'pro').length || 0;

  return NextResponse.json({
    total_users,
    pro_users,
    free_users: total_users - pro_users,
    total_games: games.count || 0,
    total_players: players.count || 0
  });
}
