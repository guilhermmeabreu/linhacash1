import { NextResponse } from 'next/server';
import { AppError } from '@/lib/http/errors';

function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_URL || '')
    .split(',')
    .map((origin) => origin.trim())
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
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-site',
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
