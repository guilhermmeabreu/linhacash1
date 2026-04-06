import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logSecurityEvent } from '@/lib/observability';

const SESSION_HEADER = 'x-session-id';
const SESSION_TOUCH_INTERVAL_MS = 2 * 60 * 1000;
const SUSPICIOUS_WINDOW_HOURS = 2;

function getSessionSecret() {
  return process.env.SESSION_IP_HASH_SECRET || process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_KEY || 'linhacash-session-secret';
}

function normalizeIp(ip: string) {
  return ip.trim().toLowerCase();
}

export function getRequestIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

export function hashIp(ip: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(normalizeIp(ip))
    .digest('hex');
}

export function getUserAgent(req: Request): string {
  return (req.headers.get('user-agent') || 'unknown').slice(0, 512);
}

type SessionRow = {
  session_id: string;
  user_id: string;
  created_at: string;
  last_seen_at: string;
  user_agent: string;
  ip_hash: string;
  is_active: boolean;
};

export async function createReplacementSession(params: {
  supabase: SupabaseClient;
  userId: string;
  req: Request;
}) {
  const { supabase, userId, req } = params;
  const sessionId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  const { data: replacedRows, error: deactivateError } = await supabase
    .from('user_sessions')
    .update({ is_active: false, invalidated_at: nowIso, invalidated_reason: 'replaced_on_login' })
    .eq('user_id', userId)
    .eq('is_active', true)
    .select('session_id');

  if (deactivateError) throw deactivateError;

  const userAgent = getUserAgent(req);
  const ipHash = hashIp(getRequestIp(req));

  const { error: insertError } = await supabase.from('user_sessions').insert({
    session_id: sessionId,
    user_id: userId,
    created_at: nowIso,
    last_seen_at: nowIso,
    user_agent: userAgent,
    ip_hash: ipHash,
    is_active: true,
  });

  if (insertError) throw insertError;

  logSecurityEvent('session_created', {
    userId,
    sessionId,
    replacedCount: replacedRows?.length || 0,
  });

  if (replacedRows?.length) {
    logSecurityEvent('session_replaced', {
      userId,
      newSessionId: sessionId,
      replacedSessionIds: replacedRows.map((row) => row.session_id),
    });
  }

  await detectSuspiciousSessionActivity({
    supabase,
    userId,
    currentSessionId: sessionId,
  });

  return { sessionId, replacedCount: replacedRows?.length || 0 };
}

export async function validateActiveSession(params: {
  supabase: SupabaseClient;
  userId: string;
  req: Request;
}) {
  const { supabase, userId, req } = params;
  const sessionId = req.headers.get(SESSION_HEADER)?.trim();

  if (!sessionId) {
    return { valid: false, reason: 'missing_session_id' as const };
  }

  const { data: row, error } = await supabase
    .from('user_sessions')
    .select('session_id,user_id,created_at,last_seen_at,user_agent,ip_hash,is_active')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .maybeSingle<SessionRow>();

  if (error) throw error;
  if (!row) return { valid: false, reason: 'session_not_found' as const };
  if (!row.is_active) return { valid: false, reason: 'session_inactive' as const };

  const ipHash = hashIp(getRequestIp(req));
  const now = Date.now();
  const lastSeen = Date.parse(row.last_seen_at);

  const patch: Record<string, string> = {};
  if (Number.isNaN(lastSeen) || now - lastSeen > SESSION_TOUCH_INTERVAL_MS) {
    patch.last_seen_at = new Date(now).toISOString();
  }

  if (row.ip_hash !== ipHash) {
    patch.ip_hash = ipHash;
  }

  const currentUa = getUserAgent(req);
  if (row.user_agent !== currentUa) {
    patch.user_agent = currentUa;
  }

  if (Object.keys(patch).length) {
    const { error: updateError } = await supabase.from('user_sessions').update(patch).eq('session_id', sessionId);
    if (updateError) throw updateError;
  }

  const suspicious = await detectSuspiciousSessionActivity({
    supabase,
    userId,
    currentSessionId: sessionId,
  });

  if (suspicious.shouldForceRelogin) {
    const nowIso = new Date().toISOString();
    await supabase
      .from('user_sessions')
      .update({ is_active: false, invalidated_at: nowIso, invalidated_reason: 'forced_relogin_suspicious_activity' })
      .eq('session_id', sessionId);

    return { valid: false, reason: 'forced_relogin' as const };
  }

  return { valid: true, sessionId };
}

export async function bootstrapSessionFromToken(params: {
  supabase: SupabaseClient;
  userId: string;
  req: Request;
}) {
  const existing = await validateActiveSession(params);
  if (existing.valid) return existing;

  const created = await createReplacementSession(params);
  return { valid: true as const, sessionId: created.sessionId, bootstrapped: true };
}

export async function invalidateAllUserSessions(params: {
  supabase: SupabaseClient;
  userId: string;
  reason: string;
}) {
  const { supabase, userId, reason } = params;
  const nowIso = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from('user_sessions')
    .update({ is_active: false, invalidated_at: nowIso, invalidated_reason: reason })
    .eq('user_id', userId)
    .eq('is_active', true)
    .select('session_id');

  if (error) throw error;

  logSecurityEvent('session_replaced', {
    userId,
    reason,
    replacedSessionIds: rows?.map((row) => row.session_id) || [],
  });

  return { count: rows?.length || 0 };
}

async function detectSuspiciousSessionActivity(params: {
  supabase: SupabaseClient;
  userId: string;
  currentSessionId: string;
}) {
  const { supabase, userId, currentSessionId } = params;
  const fromIso = new Date(Date.now() - SUSPICIOUS_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('user_sessions')
    .select('session_id,ip_hash,user_agent,created_at')
    .eq('user_id', userId)
    .gte('created_at', fromIso)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data?.length) {
    return { suspicious: false, shouldForceRelogin: false };
  }

  const ipCount = new Set(data.map((row) => row.ip_hash)).size;
  const userAgentCount = new Set(data.map((row) => row.user_agent)).size;
  const suspicious = ipCount >= 3 || userAgentCount >= 3;

  if (!suspicious) {
    return { suspicious: false, shouldForceRelogin: false };
  }

  const shouldForceRelogin =
    process.env.SESSION_FORCE_RELOGIN_ON_SUSPICIOUS === 'true' && (ipCount >= 5 || userAgentCount >= 4);

  logSecurityEvent('suspicious_activity', {
    userId,
    currentSessionId,
    ipChanges: ipCount,
    userAgentChanges: userAgentCount,
    windowHours: SUSPICIOUS_WINDOW_HOURS,
    shouldForceRelogin,
  });

  return { suspicious: true, shouldForceRelogin };
}
