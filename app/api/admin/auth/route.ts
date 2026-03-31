import { NextResponse } from 'next/server';
import { createAdminSession, destroyAdminSession } from '@/lib/auth/admin-session';
import { AppError, AuthenticationError } from '@/lib/http/errors';
import { fail, internalError, ok, options } from '@/lib/http/responses';
import { getIP, rateLimit } from '@/lib/rate-limit';
import { validateAdminLogin } from '@/lib/validators/auth-validator';
import { auditLog } from '@/lib/services/audit-log-service';
import { timingSafeEqualString } from '@/lib/auth/secure-compare';

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  try {
    const ip = getIP(req);
    if (!(await rateLimit(`admin:login:${ip}`, 5, 15 * 60_000))) {
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many login attempts'), origin);
    }

    const { email, password } = validateAdminLogin(await req.json());
    const validEmail = timingSafeEqualString(email, process.env.ADMIN_EMAIL || '');
    const validPassword = timingSafeEqualString(password, process.env.ADMIN_PASSWORD || '');
    if (!validEmail || !validPassword) {
      await auditLog('admin_login_failed', { ip });
      throw new AuthenticationError('Invalid credentials');
    }

    const response = NextResponse.json({ ok: true, data: { email } });
    await createAdminSession(response, req, email);
    await auditLog('admin_login_success', { ip });
    return response;
  } catch (error) {
    if (error instanceof AppError) return fail(error, origin);
    return internalError(origin);
  }
}

export async function DELETE(req: Request) {
  const response = ok({ ok: true });
  await destroyAdminSession(req, response);
  await auditLog('admin_logout', { ip: getIP(req) });
  return response;
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
