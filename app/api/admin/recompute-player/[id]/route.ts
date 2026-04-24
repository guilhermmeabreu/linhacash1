import { NextRequest, NextResponse } from 'next/server';
import { requireSyncExecutionAccess } from '@/lib/auth/authorization';
import { AppError, ValidationError } from '@/lib/http/errors';
import { fail, internalError, options } from '@/lib/http/responses';
import { buildRequestContext, logRouteError } from '@/lib/observability';
import { recomputeSinglePlayerMetrics } from '@/lib/services/nba-sync';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: RouteContext) {
  const origin = req.headers.get('origin') || undefined;
  const context = buildRequestContext(req, { route: '/api/admin/recompute-player/[id]', method: 'POST' });

  try {
    await requireSyncExecutionAccess(req);

    const { id } = await params;
    const playerId = Number(id);
    if (!Number.isInteger(playerId) || playerId <= 0) {
      throw new ValidationError('Invalid player id');
    }

    const result = await recomputeSinglePlayerMetrics(playerId);
    return NextResponse.json({
      success: true,
      playerId: result.playerId,
      metricsRecomputed: result.metricsRecomputed,
    });
  } catch (error) {
    if (error instanceof AppError) {
      logRouteError('/api/admin/recompute-player/[id]', context.requestId, error, { status: error.status, code: error.code });
      return fail(error, origin);
    }

    logRouteError('/api/admin/recompute-player/[id]', context.requestId, error, { status: 500 });
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
