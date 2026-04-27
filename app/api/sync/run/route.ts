import { NextResponse } from 'next/server';
import { timingSafeEqualString } from '@/lib/auth/secure-compare';
import { options } from '@/lib/http/responses';
import { getIP, rateLimit } from '@/lib/rate-limit';
import { runNbaSyncJob } from '@/lib/services/nba-sync';
import { upstashAvailable, upstashGet, upstashTtl } from '@/lib/upstash-rest';

export const runtime = 'nodejs';
export const maxDuration = 300;
const REDIS_SYNC_LOCK_KEY = 'lock:nba_sync';
type SyncMode = 'bootstrap' | 'daily';
type SyncStage = 'games' | 'stats' | 'metrics' | 'all';

function requireSyncBearerSecret(req: Request): NextResponse | null {
  const syncSecret = process.env.SYNC_SECRET?.trim();
  if (!syncSecret) {
    return NextResponse.json({ error: 'SYNC_SECRET is not configured' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7).trim();
  if (!token || !timingSafeEqualString(token, syncSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

function resolveSyncModeFromRequest(req: Request): SyncMode {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get('mode') || searchParams.get('syncMode') || '').toLowerCase();
  if (mode === 'bootstrap') return 'bootstrap';
  return 'daily';
}

function resolveTeamBatchFromRequest(req: Request): number[] {
  const { searchParams } = new URL(req.url);
  const rawTeamBatch = searchParams.get('teamBatch') || '';
  if (!rawTeamBatch) return [];
  return rawTeamBatch
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function resolveSyncStageFromRequest(req: Request): SyncStage {
  const { searchParams } = new URL(req.url);
  const stage = (searchParams.get('stage') || '').toLowerCase();
  if (stage === 'games' || stage === 'stats' || stage === 'metrics') return stage;
  return 'all';
}

async function withLockDiagnostics<T extends Record<string, unknown>>(payload: T): Promise<T | (T & {
  lockDiagnostics: {
    upstashConfigured: boolean;
    lockKey: string;
    currentTtlSeconds: number | null;
    lockValuePresent: boolean;
  };
})> {
  if (process.env.SYNC_DEBUG_LOCK_DIAGNOSTICS !== 'true') return payload;

  const upstashConfigured = upstashAvailable();
  let currentTtlSeconds: number | null = null;
  let lockValuePresent = false;

  if (upstashConfigured) {
    const [ttl, value] = await Promise.all([
      upstashTtl(REDIS_SYNC_LOCK_KEY),
      upstashGet(REDIS_SYNC_LOCK_KEY),
    ]);
    currentTtlSeconds = ttl;
    lockValuePresent = Boolean(value);
  }

  return {
    ...payload,
    lockDiagnostics: {
      upstashConfigured,
      lockKey: REDIS_SYNC_LOCK_KEY,
      currentTtlSeconds,
      lockValuePresent,
    },
  };
}

async function executeSync(req: Request) {
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const syncMode = resolveSyncModeFromRequest(req);
  const stage = resolveSyncStageFromRequest(req);
  const bootstrapTeamIds = syncMode === 'bootstrap' ? resolveTeamBatchFromRequest(req) : [];

  try {
    if (!(await rateLimit(`sync:${getIP(req)}`, 10, 60_000))) {
      return NextResponse.json({ error: 'Too many sync requests' }, { status: 429 });
    }

    const authErrorResponse = requireSyncBearerSecret(req);
    if (authErrorResponse) return authErrorResponse;

    const result = await runNbaSyncJob({ requestId, routeSource: 'manual', syncMode, bootstrapTeamIds, stage });
    const responsePayload = await withLockDiagnostics(result as Record<string, unknown>);
    const statusCode = result.status === 'error' ? 500 : result.status === 'skipped' ? 202 : 200;
    return NextResponse.json(responsePayload, { status: statusCode });
  } catch {
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function POST(req: Request) {
  return executeSync(req);
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
