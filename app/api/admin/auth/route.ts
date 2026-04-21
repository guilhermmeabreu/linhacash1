import { NextResponse } from 'next/server';
import { createAdminSession, destroyAdminSession } from '@/lib/auth/admin-session';
import { AppError, AuthenticationError } from '@/lib/http/errors';
import { fail, internalError, ok, options } from '@/lib/http/responses';
import { getIP, rateLimitDetailed } from '@/lib/rate-limit';
import { validateAdminLogin } from '@/lib/validators/auth-validator';
import { auditLog } from '@/lib/services/audit-log-service';
import { timingSafeEqualString } from '@/lib/auth/secure-compare';
import { assertAllowedOrigin, assertJsonRequest } from '@/lib/http/request-guards';
import { consumeRecoveryCode, verifyTotpCode } from '@/lib/auth/totp';
import { buildRequestContext, logRouteError } from '@/lib/observability';

function admin2faEnabled() {
  return Boolean(process.env.ADMIN_TOTP_SECRET);
}

function admin2faRequiredInProduction() {
  if (process.env.NODE_ENV !== 'production') return false;
  return process.env.ADMIN_ALLOW_PASSWORD_ONLY !== 'true';
}

function shouldEnforceAdmin2fa() {
  return admin2faRequiredInProduction() && admin2faEnabled();
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  const context = buildRequestContext(req, { route: '/api/admin/auth' });
  try {
    assertAllowedOrigin(req);
    assertJsonRequest(req);

    const ip = getIP(req);
    const rate = await rateLimitDetailed(`admin:login:${ip}`, 6, 15 * 60_000);
    if (!rate.allowed) {
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many login attempts'), origin);
    }

    const { email, password, totpCode, recoveryCode } = validateAdminLogin(await req.json());
    const validEmail = timingSafeEqualString(email, process.env.ADMIN_EMAIL || '');
    const validPassword = timingSafeEqualString(password, process.env.ADMIN_PASSWORD || '');
    if (!validEmail || !validPassword) {
      await auditLog('admin_login_failed', { ip, reason: 'invalid_credentials' });
      throw new AuthenticationError('Invalid credentials');
    }

    if (admin2faRequiredInProduction() && !admin2faEnabled()) {
      throw new AppError('INTERNAL_ERROR', 503, 'Admin 2FA is required in production');
    }

    if (shouldEnforceAdmin2fa()) {
      const validTotp = totpCode ? verifyTotpCode(process.env.ADMIN_TOTP_SECRET!, totpCode) : false;
      const validRecovery = recoveryCode ? await consumeRecoveryCode(recoveryCode) : false;
      if (!validTotp && !validRecovery) {
        await auditLog('admin_login_failed', { ip, reason: 'missing_or_invalid_2fa' });
        throw new AuthenticationError('2FA required');
      }
    }

    const response = NextResponse.json({ ok: true, data: { email, twoFactorEnabled: admin2faEnabled() } });
    await createAdminSession(response, req, email);
    await auditLog('admin_login_success', { ip });
    return response;
  } catch (error) {
    if (error instanceof AppError) {
      logRouteError('/api/admin/auth', context.requestId, error, {
        status: error.status,
        errorCode: error.code,
        adminId: process.env.ADMIN_EMAIL || 'configured_admin',
      });
      return fail(error, origin);
    }
    logRouteError('/api/admin/auth', context.requestId, error, {
      status: 500,
      adminId: process.env.ADMIN_EMAIL || 'configured_admin',
    });
    return internalError(origin);
  }
}

export async function DELETE(req: Request) {
  assertAllowedOrigin(req);
  const response = ok({ ok: true });
  await destroyAdminSession(req, response);
  await auditLog('admin_logout', { ip: getIP(req) });
  return response;
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
