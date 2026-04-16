'use client';

type StoredAuthSession = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
  tokenType?: string | null;
};

const STORAGE_KEY = 'lc_auth_session_v1';
const LEGACY_TOKEN_KEY = 'lc_token';
const EXPIRY_SKEW_SECONDS = 45;

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function toPositiveNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function readStoredAuthSession(): StoredAuthSession | null {
  if (!canUseBrowserStorage()) return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  const fallbackLegacySession = () => {
    const legacyToken = window.localStorage.getItem(LEGACY_TOKEN_KEY);
    if (!legacyToken) return null;
    return { accessToken: legacyToken, refreshToken: null, expiresAt: null, tokenType: 'bearer' };
  };

  if (!raw) return fallbackLegacySession();

  try {
    const parsed = JSON.parse(raw) as Partial<StoredAuthSession> & {
      token?: string;
      access_token?: string;
      refresh_token?: string;
      expires_at?: number | string;
      token_type?: string;
    };
    const accessToken = typeof parsed.accessToken === 'string'
      ? parsed.accessToken.trim()
      : typeof parsed.token === 'string'
        ? parsed.token.trim()
        : typeof parsed.access_token === 'string'
          ? parsed.access_token.trim()
          : '';
    if (!accessToken) return fallbackLegacySession();
    return {
      accessToken,
      refreshToken: typeof parsed.refreshToken === 'string'
        ? parsed.refreshToken
        : typeof parsed.refresh_token === 'string'
          ? parsed.refresh_token
          : null,
      expiresAt: toPositiveNumber(parsed.expiresAt ?? parsed.expires_at),
      tokenType: typeof parsed.tokenType === 'string'
        ? parsed.tokenType
        : typeof parsed.token_type === 'string'
          ? parsed.token_type
          : 'bearer',
    };
  } catch {
    return fallbackLegacySession();
  }
}

export function persistAuthSession(session: {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
  tokenType?: string | null;
}) {
  if (!canUseBrowserStorage()) return;

  const next: StoredAuthSession = {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken ?? null,
    expiresAt: toPositiveNumber(session.expiresAt),
    tokenType: session.tokenType ?? 'bearer',
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.localStorage.setItem(LEGACY_TOKEN_KEY, next.accessToken);
}

export function clearAuthSession() {
  if (!canUseBrowserStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function isSessionNearExpiry(session: StoredAuthSession | null) {
  if (!session?.expiresAt) return false;
  return Date.now() >= session.expiresAt * 1000 - EXPIRY_SKEW_SECONDS * 1000;
}

export async function refreshAuthSession(): Promise<string | null> {
  const current = readStoredAuthSession();
  if (!current?.refreshToken) return current?.accessToken || null;

  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'refresh', refreshToken: current.refreshToken }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    token?: string;
    refreshToken?: string;
    expiresAt?: number;
    tokenType?: string;
  };

  if (!res.ok || !data?.token) {
    clearAuthSession();
    return null;
  }

  persistAuthSession({
    accessToken: data.token,
    refreshToken: data.refreshToken ?? current.refreshToken,
    expiresAt: data.expiresAt ?? null,
    tokenType: data.tokenType ?? 'bearer',
  });

  return data.token;
}

export async function ensureValidAccessToken(): Promise<string | null> {
  const current = readStoredAuthSession();
  if (!current) return null;
  if (!isSessionNearExpiry(current)) return current.accessToken;
  return refreshAuthSession();
}

export function captureAuthSessionFromUrl(url: URL): { flow: string; hasError: boolean } {
  const search = url.searchParams;
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));

  const accessToken = hash.get('access_token') || search.get('access_token');
  const refreshToken = hash.get('refresh_token') || search.get('refresh_token');
  const expiresAt = toPositiveNumber(hash.get('expires_at') || search.get('expires_at'));
  const tokenType = hash.get('token_type') || search.get('token_type') || 'bearer';

  if (accessToken) {
    persistAuthSession({
      accessToken,
      refreshToken,
      expiresAt,
      tokenType,
    });
  }

  const flow = (search.get('auth_flow') || search.get('type') || '').toLowerCase();
  const hasError = Boolean(hash.get('error') || search.get('error') || search.get('error_description') || hash.get('error_description'));
  return { flow, hasError };
}
