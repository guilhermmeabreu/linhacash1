import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/authorization';
import { AppError } from '@/lib/http/errors';
import { fail, internalError, options } from '@/lib/http/responses';
import { getIP, rateLimitDetailed } from '@/lib/rate-limit';
import { buildRequestContext, logRouteError, logSecurityEvent } from '@/lib/observability';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  const context = buildRequestContext(req, { route: '/api/admin/sync/run', method: 'POST' });

  try {
    const admin = await requireAdminUser(req);
    const rate = await rateLimitDetailed(`admin:sync-run:${admin.email}:${getIP(req)}`, 8, 60_000);
    if (!rate.allowed) {
      logSecurityEvent('route_rate_limited', { ...context, adminEmail: admin.email, retryAfterSeconds: rate.retryAfterSeconds });
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many admin sync requests'), origin);
    }

    const syncSecret = process.env.SYNC_SECRET?.trim();
    if (!syncSecret) {
      return NextResponse.json({ error: 'SYNC_SECRET is not configured' }, { status: 500 });
    }

    const upstreamUrl = new URL('/api/sync/run', req.url);
    upstreamUrl.search = new URL(req.url).search;

    const requestId = req.headers.get('x-request-id');
    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${syncSecret}`,
        ...(requestId ? { 'x-request-id': requestId } : {}),
      },
      cache: 'no-store',
    });

    const contentType = upstreamResponse.headers.get('content-type') || 'application/json; charset=utf-8';
    const payload = await upstreamResponse.text();

    return new NextResponse(payload, {
      status: upstreamResponse.status,
      headers: {
        'content-type': contentType,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      logRouteError('/api/admin/sync/run', context.requestId, error, { status: error.status, code: error.code });
      return fail(error, origin);
    }

    logRouteError('/api/admin/sync/run', context.requestId, error, { status: 500 });
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
