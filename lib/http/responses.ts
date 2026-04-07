import { NextResponse } from 'next/server';
import { AppError } from '@/lib/http/errors';

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

function allowedOrigins(): string[] {
  return [
    'https://linhacash.com.br',
    'https://www.linhacash.com.br',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    process.env.NEXT_PUBLIC_URL || '',
    process.env.ALLOWED_ORIGINS || '',
  ]
    .flatMap((value) => value.split(','))
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);
}

export function buildSecurityHeaders(origin?: string): Record<string, string> {
  const allow = allowedOrigins();
  const responseOrigin = origin && allow.includes(origin) ? origin : allow[0] || 'https://linhacash.com.br';
  return {
    'Access-Control-Allow-Origin': responseOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-cron-secret, x-signature, x-request-id',
    Vary: 'Origin',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-site',
    'X-DNS-Prefetch-Control': 'off',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'X-Robots-Tag': 'noindex, nofollow',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  };
}

export function ok<T>(data: T, status = 200, origin?: string) {
  return NextResponse.json({ ok: true, data }, { status, headers: buildSecurityHeaders(origin) });
}

export function fail(error: AppError, origin?: string) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.code === 'VALIDATION_ERROR' && error.details ? { details: error.details } : {}),
      },
    },
    { status: error.status, headers: buildSecurityHeaders(origin) },
  );
}

export function internalError(origin?: string) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    },
    { status: 500, headers: buildSecurityHeaders(origin) },
  );
}

export function options(origin?: string) {
  return new NextResponse(null, { status: 204, headers: buildSecurityHeaders(origin) });
}
