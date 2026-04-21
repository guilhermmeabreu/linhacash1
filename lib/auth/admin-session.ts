import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { AuthenticationError } from '@/lib/http/errors';

const COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-lc_admin_session' : 'lc_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;
let warnedWeakSecretFallback = false;

type AdminSessionPayload = {
  sid: string;
  email: string;
  exp: number;
  ipHash: string | null;
  uaHash: string | null;
};

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function hash(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function requestIp(req: Request) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function requestUa(req: Request) {
  return req.headers.get('user-agent') || 'unknown';
}

function shouldBindAdminSessionToIp() {
  return process.env.ADMIN_SESSION_BIND_IP === 'true';
}

function shouldBindAdminSessionToUa() {
  return process.env.ADMIN_SESSION_BIND_UA === 'true';
}

function readCookie(req: Request, cookieName: string): string | null {
  const raw = req.headers.get('cookie') || '';
  const found = raw
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  return found ? decodeURIComponent(found.split('=').slice(1).join('=')) : null;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function getAdminSessionSecret() {
  const configured = process.env.ADMIN_SESSION_SECRET?.trim();
  if (configured) return configured;

  const strictSecret = process.env.ADMIN_SESSION_STRICT_SECRET === 'true';
  if (process.env.NODE_ENV === 'production' && strictSecret) {
    throw new AuthenticationError('Admin session secret not configured');
  }

  const fallback = `${process.env.ADMIN_PASSWORD || ''}:${process.env.SUPABASE_SERVICE_KEY || ''}`.trim();
  if (fallback && fallback !== ':') {
    if (process.env.NODE_ENV === 'production' && !warnedWeakSecretFallback) {
      warnedWeakSecretFallback = true;
      console.error('[SECURITY] ADMIN_SESSION_SECRET ausente em produção. Usando fallback legado; configure ADMIN_SESSION_SECRET e habilite ADMIN_SESSION_STRICT_SECRET=true.');
    }
    return fallback;
  }

  return 'linhacash-dev-admin-session-secret';
}

function signPayload(payloadBase64Url: string) {
  return crypto.createHmac('sha256', getAdminSessionSecret()).update(payloadBase64Url).digest('base64url');
}

function serializeSession(payload: AdminSessionPayload) {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function parseSession(token: string): AdminSessionPayload | null {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expected = signPayload(encodedPayload);
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const signatureBuffer = Buffer.from(signature, 'utf8');
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(encodedPayload)) as Partial<AdminSessionPayload>;
    if (
      typeof parsed.sid !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.exp !== 'number' ||
      (parsed.ipHash !== null && parsed.ipHash !== undefined && typeof parsed.ipHash !== 'string') ||
      (parsed.uaHash !== null && parsed.uaHash !== undefined && typeof parsed.uaHash !== 'string')
    ) {
      return null;
    }

    return {
      sid: parsed.sid,
      email: parsed.email,
      exp: parsed.exp,
      ipHash: parsed.ipHash ?? null,
      uaHash: parsed.uaHash ?? null,
    };
  } catch {
    return null;
  }
}

export async function createAdminSession(response: NextResponse, req: Request, email: string) {
  const ip = requestIp(req);
  const ua = requestUa(req);
  const payload: AdminSessionPayload = {
    sid: crypto.randomBytes(32).toString('hex'),
    email,
    exp: nowSeconds() + SESSION_TTL_SECONDS,
    ipHash: ip && ip !== 'unknown' ? hash(ip) : null,
    uaHash: ua && ua !== 'unknown' ? hash(ua) : null,
  };

  response.cookies.set({
    name: COOKIE_NAME,
    value: serializeSession(payload),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function requireAdminSession(req: Request) {
  const token = readCookie(req, COOKIE_NAME);
  if (!token) throw new AuthenticationError();

  const session = parseSession(token);
  if (!session || session.exp <= nowSeconds()) {
    throw new AuthenticationError();
  }

  if (shouldBindAdminSessionToIp() && session.ipHash) {
    const currentIp = requestIp(req);
    if (currentIp !== 'unknown' && session.ipHash !== hash(currentIp)) {
      throw new AuthenticationError();
    }
  }

  if (shouldBindAdminSessionToUa() && session.uaHash) {
    const ua = requestUa(req);
    if (ua !== 'unknown' && session.uaHash !== hash(ua)) {
      throw new AuthenticationError();
    }
  }

  return { email: session.email, sessionId: session.sid };
}

export async function destroyAdminSession(_req: Request, response: NextResponse) {
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
