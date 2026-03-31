import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { AuthenticationError } from '@/lib/http/errors';

const COOKIE_NAME = 'lc_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const memoryStore = new Map<string, { expiresAt: number; email: string; ipHash: string; uaHash: string }>();

function getStoreMode() {
  return process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? 'redis' : 'memory';
}

function now() {
  return Date.now();
}

function hash(v: string) {
  return crypto.createHash('sha256').update(v).digest('hex');
}

function requestIp(req: Request) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function requestUa(req: Request) {
  return req.headers.get('user-agent') || 'unknown';
}


function readCookie(req: Request, cookieName: string): string | null {
  const raw = req.headers.get('cookie') || '';
  const found = raw.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  return found ? decodeURIComponent(found.split('=').slice(1).join('=')) : null;
}
async function persistSession(sessionId: string, email: string, ip: string, ua: string) {
  const expiresAt = now() + SESSION_TTL_SECONDS * 1000;
  const payload = { expiresAt, email, ipHash: hash(ip), uaHash: hash(ua) };
  if (getStoreMode() === 'redis') {
    const url = process.env.UPSTASH_REDIS_REST_URL!;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
    await fetch(`${url}/set/${encodeURIComponent(`admin:sess:${sessionId}`)}/${encodeURIComponent(JSON.stringify(payload))}?EX=${SESSION_TTL_SECONDS}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    return;
  }
  memoryStore.set(sessionId, payload);
}

async function readSession(sessionId: string) {
  if (getStoreMode() === 'redis') {
    const url = process.env.UPSTASH_REDIS_REST_URL!;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
    const response = await fetch(`${url}/get/${encodeURIComponent(`admin:sess:${sessionId}`)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const data = await response.json();
    if (!data.result) return null;
    return JSON.parse(data.result as string) as { expiresAt: number; email: string; ipHash: string; uaHash: string };
  }
  const found = memoryStore.get(sessionId);
  if (!found) return null;
  if (now() > found.expiresAt) {
    memoryStore.delete(sessionId);
    return null;
  }
  return found;
}

async function deleteSession(sessionId: string) {
  if (getStoreMode() === 'redis') {
    const url = process.env.UPSTASH_REDIS_REST_URL!;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
    await fetch(`${url}/del/${encodeURIComponent(`admin:sess:${sessionId}`)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    return;
  }
  memoryStore.delete(sessionId);
}

export async function createAdminSession(response: NextResponse, req: Request, email: string) {
  const sessionId = crypto.randomBytes(48).toString('hex');
  await persistSession(sessionId, email, requestIp(req), requestUa(req));

  response.cookies.set({
    name: COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function requireAdminSession(req: Request) {
  const sessionId = readCookie(req, COOKIE_NAME);
  if (!sessionId) throw new AuthenticationError();

  const session = await readSession(sessionId);
  if (!session) throw new AuthenticationError();

  const isValidIp = session.ipHash === hash(requestIp(req));
  const isValidUa = session.uaHash === hash(requestUa(req));
  if (!isValidIp || !isValidUa) {
    await deleteSession(sessionId);
    throw new AuthenticationError();
  }

  return { email: session.email, sessionId };
}

export async function destroyAdminSession(req: Request, response: NextResponse) {
  const sessionId = readCookie(req, COOKIE_NAME);
  if (sessionId) await deleteSession(sessionId);
  response.cookies.set({ name: COOKIE_NAME, value: '', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 });
}
