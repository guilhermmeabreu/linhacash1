import { NextRequest, NextResponse } from 'next/server';
import { requireSyncExecutionAccess } from '@/lib/auth/authorization';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { AppError, ValidationError } from '@/lib/http/errors';
import { fail, internalError, options } from '@/lib/http/responses';
import { buildRequestContext, logRouteError } from '@/lib/observability';
import { invalidateCacheByPrefix } from '@/lib/cache/memory-cache';
import { recomputeSinglePlayerMetrics } from '@/lib/services/nba-sync';

export const runtime = 'nodejs';
export const maxDuration = 300;

type RecomputeBatchPayload = {
  playerIds?: unknown;
};

const PLAYER_CHUNK_SIZE = 25;

function sanitizePlayerIds(input: Iterable<number>): number[] {
  return [...new Set([...input].filter((playerId) => Number.isInteger(playerId) && playerId > 0))];
}

async function findPlayerIdsMissingMetricsFromStats(): Promise<number[]> {
  const supabase = getSupabaseAdmin();
  const pageSize = 1000;
  const playerIdsWithStats = new Set<number>();

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('player_stats')
      .select('player_id')
      .order('player_id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`player_stats read failed while loading ids with stats: ${error.message}`);
    }

    const rows = data || [];
    for (const row of rows as Array<{ player_id: number | null }>) {
      const playerId = Number(row.player_id);
      if (Number.isInteger(playerId) && playerId > 0) {
        playerIdsWithStats.add(playerId);
      }
    }

    if (rows.length < pageSize) break;
  }

  const candidatePlayerIds = [...playerIdsWithStats];
  if (!candidatePlayerIds.length) return [];

  const playersWithMetrics = new Set<number>();
  const metricChunkSize = 500;
  for (let index = 0; index < candidatePlayerIds.length; index += metricChunkSize) {
    const chunk = candidatePlayerIds.slice(index, index + metricChunkSize);
    const { data, error } = await supabase
      .from('player_metrics')
      .select('player_id')
      .in('player_id', chunk);

    if (error) {
      throw new Error(`player_metrics read failed while loading ids with metrics: ${error.message}`);
    }

    for (const row of (data || []) as Array<{ player_id: number | null }>) {
      const playerId = Number(row.player_id);
      if (Number.isInteger(playerId) && playerId > 0) {
        playersWithMetrics.add(playerId);
      }
    }
  }

  return candidatePlayerIds.filter((playerId) => !playersWithMetrics.has(playerId));
}

async function countPlayersMissingMetrics(playerIds: Iterable<number>): Promise<number> {
  const uniquePlayerIds = sanitizePlayerIds(playerIds);
  if (!uniquePlayerIds.length) return 0;

  const supabase = getSupabaseAdmin();
  const playersWithMetrics = new Set<number>();
  const chunkSize = 500;
  for (let index = 0; index < uniquePlayerIds.length; index += chunkSize) {
    const chunk = uniquePlayerIds.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from('player_metrics')
      .select('player_id')
      .in('player_id', chunk);

    if (error) {
      throw new Error(`player_metrics read failed while checking missing metrics: ${error.message}`);
    }

    for (const row of (data || []) as Array<{ player_id: number | null }>) {
      const playerId = Number(row.player_id);
      if (Number.isInteger(playerId) && playerId > 0) {
        playersWithMetrics.add(playerId);
      }
    }
  }

  return uniquePlayerIds.length - playersWithMetrics.size;
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin') || undefined;
  const context = buildRequestContext(req, { route: '/api/admin/recompute-batch', method: 'POST' });

  try {
    await requireSyncExecutionAccess(req);

    const body = (await req.json().catch(() => ({}))) as RecomputeBatchPayload;
    let playerIds: number[] = [];

    if (body.playerIds !== undefined) {
      if (!Array.isArray(body.playerIds)) {
        throw new ValidationError('playerIds must be an array of player ids');
      }

      playerIds = body.playerIds.map((playerId) => Number(playerId));
      if (playerIds.some((playerId) => !Number.isInteger(playerId) || playerId <= 0)) {
        throw new ValidationError('playerIds must contain only positive integer ids');
      }
    }

    if (!playerIds.length) {
      playerIds = await findPlayerIdsMissingMetricsFromStats();
    }

    const targetPlayerIds = sanitizePlayerIds(playerIds);
    let metricsRecomputed = 0;

    for (let index = 0; index < targetPlayerIds.length; index += PLAYER_CHUNK_SIZE) {
      const chunk = targetPlayerIds.slice(index, index + PLAYER_CHUNK_SIZE);
      for (const playerId of chunk) {
        const result = await recomputeSinglePlayerMetrics(playerId);
        metricsRecomputed += result.metricsRecomputed;
      }
    }

    const missingMetricsAfter = await countPlayersMissingMetrics(targetPlayerIds);

    invalidateCacheByPrefix('games:');
    invalidateCacheByPrefix('players:');
    invalidateCacheByPrefix('metrics:');
    invalidateCacheByPrefix('metrics-base:');

    return NextResponse.json({
      success: true,
      processedPlayers: targetPlayerIds.length,
      metricsRecomputed,
      missingMetricsAfter,
    });
  } catch (error) {
    if (error instanceof AppError) {
      logRouteError('/api/admin/recompute-batch', context.requestId, error, { status: error.status, code: error.code });
      return fail(error, origin);
    }

    logRouteError('/api/admin/recompute-batch', context.requestId, error, { status: 500 });
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
