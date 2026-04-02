import { AppError, AuthenticationError } from '@/lib/http/errors';

function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function getConfiguredOrigins(): string[] {
  return [process.env.NEXT_PUBLIC_URL || '', process.env.ALLOWED_ORIGINS || '']
    .flatMap((value) => value.split(','))
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin);
}

function getLocalDevOrigins(): string[] {
  return ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'];
}

function getVercelProjectSlug(): string | null {
  const configuredProd = process.env.VERCEL_PROJECT_PRODUCTION_URL || '';
  if (configuredProd.endsWith('.vercel.app')) {
    return configuredProd.split('.vercel.app')[0].toLowerCase();
  }

  const vercelUrl = process.env.VERCEL_URL || '';
  if (vercelUrl.endsWith('.vercel.app')) {
    const host = vercelUrl.toLowerCase().split('.vercel.app')[0];
    const match = host.match(/^([a-z0-9-]+?)(?:-git-|-[a-z0-9]+$)/);
    return match?.[1] || host;
  }

  return null;
}

function isAllowedVercelPreview(origin: string): boolean {
  const host = normalizeHost(origin);
  if (!host.endsWith('.vercel.app')) return false;

  const projectSlug = getVercelProjectSlug();
  if (!projectSlug) {
    const vercelUrl = normalizeHost(process.env.VERCEL_URL || '');
    return Boolean(vercelUrl) && host === vercelUrl;
  }

  return host === `${projectSlug}.vercel.app` || host.startsWith(`${projectSlug}-`);
}

function allowedOrigins(): string[] {
  return [...new Set([...getConfiguredOrigins(), ...getLocalDevOrigins()])];
}

function hasSafeMethod(req: Request) {
  return ['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
}

export function assertAllowedOrigin(req: Request) {
  if (hasSafeMethod(req)) return;

  const requestOrigin = req.headers.get('origin');
  if (!requestOrigin) {
    throw new AuthenticationError('Missing request origin');
  }

  const normalizedOrigin = normalizeOrigin(requestOrigin);
  const allowList = allowedOrigins();

  if (allowList.includes(normalizedOrigin)) return;
  if (isAllowedVercelPreview(normalizedOrigin)) return;

  throw new AppError('AUTHORIZATION_ERROR', 403, 'Origin not allowed');
}

export function assertJsonRequest(req: Request) {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new AppError('VALIDATION_ERROR', 415, 'Content-Type application/json is required');
  }
}

export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
  assertJsonRequest(req);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid JSON body');
  }
  return body as Record<string, unknown>;
}
