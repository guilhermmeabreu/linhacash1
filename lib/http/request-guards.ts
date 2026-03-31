import { AppError, AuthenticationError } from '@/lib/http/errors';

function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin);
}

export function assertAllowedOrigin(req: Request) {
  const requestOrigin = req.headers.get('origin');
  if (!requestOrigin) {
    throw new AuthenticationError('Missing request origin');
  }

  const normalizedOrigin = normalizeOrigin(requestOrigin);
  const allowList = allowedOrigins();
  if (!allowList.includes(normalizedOrigin)) {
    throw new AppError('AUTHORIZATION_ERROR', 403, 'Origin not allowed');
  }
}

export function assertJsonRequest(req: Request) {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new AppError('VALIDATION_ERROR', 415, 'Content-Type application/json is required');
  }
}
