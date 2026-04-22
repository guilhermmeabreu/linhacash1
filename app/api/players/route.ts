import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateSession, sanitizePlayer, errorResponse, okResponse, corsHeaders } from '@/lib/security';
import { rateLimit, getIP } from '@/lib/rate-limit';
import { getCachedValue } from '@/lib/cache/memory-cache';
import { buildRequestContext, logHotPathRead, logRouteError, logSecurityEvent } from '@/lib/observability';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type PlayerRow = {
  id: number;
  api_id: number | null;
  name: string;
  team_id: number;
  position: string | null;
  photo: string | null;
};

type PlayerStatRow = {
  player_id: number;
  minutes: number | null;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  three_pointers: number | null;
  steals: number | null;
  blocks: number | null;
};

type RankedPlayer = {
  player: PlayerRow;
  score: number;
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function rankPlayersForProps(players: PlayerRow[], statRows: PlayerStatRow[]): PlayerRow[] {
  if (!players.length) return [];
  const statsByPlayer = new Map<number, PlayerStatRow[]>();
  statRows.forEach((row) => {
    const bucket = statsByPlayer.get(row.player_id) || [];
    bucket.push(row);
    statsByPlayer.set(row.player_id, bucket);
  });

  const ranked: RankedPlayer[] = players.map((player) => {
    const samples = statsByPlayer.get(player.id) || [];
    const minutesValues = samples.map((sample) => toNumber(sample.minutes)).filter((value) => value > 0);
    const recentMinutes = minutesValues.slice(0, 5);
    const seasonMinutesAvg = avg(minutesValues);
    const recentMinutesAvg = avg(recentMinutes);
    const sampleSize = samples.length;
    const validGames = samples.filter((sample) => toNumber(sample.minutes) >= 8).length;
    const statPresence = samples.filter((sample) => (
      toNumber(sample.points) > 0
      || toNumber(sample.rebounds) > 0
      || toNumber(sample.assists) > 0
      || toNumber(sample.three_pointers) > 0
      || toNumber(sample.steals) > 0
      || toNumber(sample.blocks) > 0
    )).length;

    const relevanceScore = (
      seasonMinutesAvg * 1.5
      + recentMinutesAvg * 2
      + Math.min(sampleSize, 30) * 0.8
      + Math.min(validGames, 20) * 0.7
      + Math.min(statPresence, 20) * 0.6
    );

    return { player, score: relevanceScore };
  });

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.player.name.localeCompare(b.player.name, 'pt-BR');
  });

  const relevantOnly = ranked.filter((entry) => {
    const samples = statsByPlayer.get(entry.player.id) || [];
    const minutesValues = samples.map((sample) => toNumber(sample.minutes)).filter((value) => value > 0);
    const recentMinutesAvg = avg(minutesValues.slice(0, 5));
    const seasonMinutesAvg = avg(minutesValues);
    const sampleSize = samples.length;
    return sampleSize >= 4 && (seasonMinutesAvg >= 12 || recentMinutesAvg >= 14);
  });

  const source = relevantOnly.length >= 8 ? relevantOnly : ranked;
  return source.slice(0, 12).map((entry) => entry.player);
}

// GET /api/players?gameId=xxx — jogadores de um jogo
export async function GET(req: Request) {
  const context = buildRequestContext(req, { route: '/api/players' });
  const startedAt = Date.now();
  try {
    const session = await validateSession(req);
    if (!session.valid) {
      logSecurityEvent('auth_failed', { ...context, reason: session.error || 'unauthorized' });
      return errorResponse('Não autorizado', 401);
    }

    if (!await rateLimit(getIP(req), 60, 60000)) {
      logSecurityEvent('route_rate_limited', { ...context, userId: session.userId || null });
      return errorResponse('Muitas requisições', 429);
    }

    const { searchParams } = new URL(req.url);
    const gameId = searchParams.get('gameId');
    if (!gameId || !/^\d+$/.test(gameId)) return errorResponse('gameId inválido');

    const cacheKey = `players:${gameId}`;
    const cacheTtlMs = 120_000;
    const result = await getCachedValue(cacheKey, cacheTtlMs, async () => {
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('id, home_team_id, away_team_id')
        .eq('id', gameId)
        .single();

      if (gameError) throw gameError;
      if (!game) throw new Error('Jogo não encontrado');

      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('id, api_id, name, team_id, position, photo')
        .in('team_id', [game.home_team_id, game.away_team_id]);

      if (playersError) throw playersError;

      const typedPlayers = (players || []) as PlayerRow[];
      const playerIds = typedPlayers.map((player) => player.id).filter((id) => Number.isFinite(id));

      let rankedPlayers = typedPlayers;
      if (playerIds.length) {
        const { data: statRows, error: statsError } = await supabase
          .from('player_stats')
          .select('player_id,minutes,points,rebounds,assists,three_pointers,steals,blocks')
          .in('player_id', playerIds)
          .order('game_date', { ascending: false })
          .limit(3000);
        if (statsError) throw statsError;

        const typedStats = (statRows || []) as PlayerStatRow[];
        const homePlayers = typedPlayers.filter((player) => player.team_id === game.home_team_id);
        const awayPlayers = typedPlayers.filter((player) => player.team_id === game.away_team_id);

        rankedPlayers = [
          ...rankPlayersForProps(homePlayers, typedStats),
          ...rankPlayersForProps(awayPlayers, typedStats),
        ];
      }

      return rankedPlayers.map(sanitizePlayer);
    }).catch((error) => {
      if (error instanceof Error && error.message === 'Jogo não encontrado') {
        return 'not_found' as const;
      }
      logRouteError('/api/players', context.requestId, error, { status: 500, userId: session.userId || null, provider: 'supabase' });
      return null;
    });

    if (result === 'not_found') return errorResponse('Jogo não encontrado', 404);
    if (!result) return errorResponse('Erro ao buscar jogadores', 500);

    logHotPathRead('/api/players', {
      requestId: context.requestId,
      userId: session.userId || null,
      cacheKey,
      cacheTtlMs,
      durationMs: Date.now() - startedAt,
      rowCount: result.length,
      gameId,
    });

    return okResponse({ players: result });
  } catch (error) {
    logRouteError('/api/players', context.requestId, error, { status: 500, provider: 'supabase' });
    return errorResponse('Erro ao buscar jogadores', 500);
  }
}

// OPTIONS — CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}
