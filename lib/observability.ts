import { AppError } from '@/lib/http/errors';
import crypto from 'crypto';

export type SecurityEvent =
  | 'checkout_attempt'
  | 'checkout_failed'
  | 'checkout_created'
  | 'support_attempt'
  | 'support_internal_email_started'
  | 'support_internal_email_sent'
  | 'support_internal_email_failed'
  | 'support_confirmation_email_sent'
  | 'support_confirmation_email_failed'
  | 'support_failed'
  | 'auth_attempt'
  | 'auth_failed'
  | 'auth_success'
  | 'account_delete_attempt'
  | 'account_delete_failed'
  | 'webhook_received'
  | 'webhook_denied'
  | 'webhook_processed'
  | 'webhook_failed'
  | 'route_rate_limited';

function maskIp(ip: string): string {
  if (!ip || ip === 'unknown') return 'unknown';
  if (ip.includes(':')) return `${ip.split(':').slice(0, 3).join(':')}:*`;
  const parts = ip.split('.');
  if (parts.length !== 4) return 'unknown';
  return `${parts[0]}.${parts[1]}.${parts[2]}.*`;
}

export function getRequestId(req: Request): string {
  const headerId = req.headers.get('x-request-id') || req.headers.get('x-correlation-id');
  if (headerId && /^[a-zA-Z0-9:_\-.]{8,200}$/.test(headerId)) return headerId;
  return crypto.randomUUID();
}

function safeError(error: unknown): Record<string, unknown> {
  if (error instanceof AppError) {
    return { kind: 'app', code: error.code, status: error.status, message: error.message };
  }
  if (error instanceof Error) {
    return { kind: 'native', name: error.name, message: error.message };
  }
  return { kind: 'unknown' };
}

function extractErrorCode(error: unknown): string {
  if (error instanceof AppError) return error.code;
  if (error instanceof Error && error.name) return error.name;
  return 'UNKNOWN_ERROR';
}

export function logSecurityEvent(event: SecurityEvent, payload: Record<string, unknown>) {
  console.info('[security]', JSON.stringify({ event, ts: new Date().toISOString(), ...payload }));
}

export function logRouteError(route: string, requestId: string, error: unknown, extra?: Record<string, unknown>) {
  console.error(
    '[route-error]',
    JSON.stringify({
      route,
      requestId,
      ts: new Date().toISOString(),
      status: 500,
      errorCode: extractErrorCode(error),
      error: safeError(error),
      ...extra,
    }),
  );
}

export function buildRequestContext(req: Request, extra?: Record<string, unknown>) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  return {
    requestId: getRequestId(req),
    ipMasked: maskIp(ip),
    method: req.method,
    path: new URL(req.url).pathname,
    ...extra,
  };
}
