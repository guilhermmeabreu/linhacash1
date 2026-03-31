import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildSecurityHeaders } from '@/lib/http/responses';

const NON_API_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
};

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const proto = req.headers.get('x-forwarded-proto');

  if (process.env.NODE_ENV === 'production' && proto && proto !== 'https') {
    url.protocol = 'https:';
    return NextResponse.redirect(url, 308);
  }

  const response = NextResponse.next();
  const isApi = req.nextUrl.pathname.startsWith('/api/');
  const headers = isApi ? buildSecurityHeaders(req.headers.get('origin') || undefined) : NON_API_HEADERS;
  Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
