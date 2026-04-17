import { NextResponse } from 'next/server';
import { requireSyncExecutionAccess } from '@/lib/auth/authorization';
import { AppError } from '@/lib/http/errors';
import { fail, options } from '@/lib/http/responses';
import { getIP, rateLimit } from '@/lib/rate-limit';
import { runNbaSyncJob } from '@/lib/services/nba-sync';
import { upstashAvailable, upstashGet, upstashTtl } from '@/lib/upstash-rest';

export const runtime = 'nodejs';
const REDIS_SYNC_LOCK_KEY = 'lock:nba_sync';
type SyncMode = 'bootstrap' | 'daily';

function resolveSyncModeFromRequest(req: Request): SyncMode {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get('mode') || searchParams.get('syncMode') || '').toLowerCase();
  if (mode === 'bootstrap') return 'bootstrap';
  return 'daily';
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
  const origin = req.headers.get('origin') || undefined;
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const syncMode = resolveSyncModeFromRequest(req);

  try {
    if (!(await rateLimit(`sync:${getIP(req)}`, 10, 60_000))) {
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many sync requests'), origin);
    }

    await requireSyncExecutionAccess(req);
    const result = await runNbaSyncJob({ requestId, routeSource: 'cron', syncMode });
    const responsePayload = await withLockDiagnostics(result as Record<string, unknown>);
    const statusCode = result.status === 'error' ? 500 : result.status === 'skipped' ? 202 : 200;
    return NextResponse.json(responsePayload, { status: statusCode });
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error, origin);
    }

    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return executeSync(req);
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
