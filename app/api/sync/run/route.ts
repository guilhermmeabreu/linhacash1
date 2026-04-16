import { NextResponse } from 'next/server';
import { requireSyncExecutionAccess } from '@/lib/auth/authorization';
import { AppError } from '@/lib/http/errors';
import { fail, options } from '@/lib/http/responses';
import { getIP, rateLimit } from '@/lib/rate-limit';
import { runNbaSyncJob } from '@/lib/services/nba-sync';

export const runtime = 'nodejs';

async function executeSync(req: Request) {
  const origin = req.headers.get('origin') || undefined;

  try {
    if (!(await rateLimit(`sync:${getIP(req)}`, 10, 60_000))) {
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many sync requests'), origin);
    }

    await requireSyncExecutionAccess(req);
    const result = await runNbaSyncJob();
    const statusCode = result.status === 'error' ? 500 : result.status === 'skipped' ? 202 : 200;
    return NextResponse.json(result, { status: statusCode });
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

export async function POST(req: Request) {
  return executeSync(req);
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
