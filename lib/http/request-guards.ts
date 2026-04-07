import { AppError, AuthenticationError } from '@/lib/http/errors';

function normalizeOrigin(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    return new URL(trimmed).origin;
  } catch {
    try {
      return new URL(`https://${trimmed.replace(/^\/+/, '')}`).origin;
    } catch {
      return trimmed;
    }
  }
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function parseHostname(value: string): string {
  const normalized = normalizeOrigin(value);
  if (!normalized) return '';
  try {
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return normalizeHost(normalized).split('/')[0] || '';
  }
}

function getConfiguredOrigins(): string[] {
  return [
    'https://linhacash.com.br',
    'https://www.linhacash.com.br',
    process.env.NEXT_PUBLIC_URL || '',
    process.env.ALLOWED_ORIGINS || '',
  ]
    .flatMap((value) => value.split(','))
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin);
}

function getLocalDevOrigins(): string[] {
  return ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'];
}

function getVercelProjectSlugCandidates(): string[] {
  const candidates = new Set<string>(['linhacash']);

  const configuredProd = process.env.VERCEL_PROJECT_PRODUCTION_URL || '';
  const configuredProdHost = parseHostname(configuredProd);
  if (configuredProdHost.endsWith('.vercel.app')) {
    candidates.add(configuredProdHost.replace(/\.vercel\.app$/, ''));
  }

  const vercelUrl = process.env.VERCEL_URL || '';
  const vercelHost = parseHostname(vercelUrl);
  if (vercelHost.endsWith('.vercel.app')) {
    candidates.add(vercelHost.replace(/\.vercel\.app$/, ''));
  }

  for (const origin of getConfiguredOrigins()) {
    const host = parseHostname(origin);
    if (host.endsWith('.vercel.app')) {
      candidates.add(host.replace(/\.vercel\.app$/, ''));
    }
  }

  const slugs = [...candidates]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .flatMap((value) => {
      const extracted = value.match(/^([a-z0-9-]+?)(?:-git-|-[a-z0-9]+$)/)?.[1];
      return extracted ? [value, extracted] : [value];
    });

  return [...new Set(slugs)];
}

function isAllowedVercelPreview(origin: string): boolean {
  const hostname = parseHostname(origin);
  if (!hostname.endsWith('.vercel.app')) return false;
  const previewHost = hostname.replace(/\.vercel\.app$/, '');

  const candidates = getVercelProjectSlugCandidates();
  return candidates.some((slug) => previewHost === slug || previewHost.startsWith(`${slug}-`));
}

function allowedOrigins(): string[] {
  return [...new Set([...getConfiguredOrigins(), ...getLocalDevOrigins()])];
}

function hasSafeMethod(req: Request) {
  return ['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
}

export function assertAllowedOrigin(req: Request) {
  if (hasSafeMethod(req)) return;

  const requestOrigin = req.headers.get('origin') || '';
  if (!requestOrigin) {
    throw new AuthenticationError('Missing request origin');
  }

  const normalizedOrigin = normalizeOrigin(requestOrigin);
  const allowList = allowedOrigins();

  if (allowList.includes(normalizedOrigin)) return;
  if (isAllowedVercelPreview(normalizedOrigin)) return;

  console.warn('[SECURITY] Blocked request origin', {
    requestOrigin,
    normalizedOrigin,
    allowList,
  });
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
