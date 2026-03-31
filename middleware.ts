import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildSecurityHeaders } from '@/lib/http/responses';

export function middleware(req: NextRequest) {
  const response = NextResponse.next();
  const headers = buildSecurityHeaders(req.headers.get('origin') || undefined);
  Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
