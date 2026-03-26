import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const adminAuth = req.cookies.get('admin_auth');
    if (!adminAuth || adminAuth.value !== process.env.ADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*']
};
