import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getIP } from './rate-limit';
import * as crypto from 'crypto';
import { requireEnv } from '@/lib/env';
import { getBillingState } from '@/lib/services/billing-service';

// ── Supabase server client — NUNCA exposto ao frontend ──────────────────────
export function getSupabaseServer() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ── Validar JWT do usuário em cada request ──────────────────────────────────
export async function validateSession(req: Request): Promise<{
  valid: boolean;
  userId?: string;
  email?: string;
  plan?: string;
  error?: string;
}> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { valid: false, error: 'Token ausente' };
  }

  const token = authHeader.slice(7);
  const supabase = getSupabaseServer();

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { valid: false, error: 'Token inválido ou expirado' };
  }

  const billing = await getBillingState(user.id);

  return {
    valid: true,
    userId: user.id,
    email: user.email,
    plan: billing.hasProAccess ? 'pro' : 'free'
  };
}

// ── Validar se usuário tem plano Pro ────────────────────────────────────────
export async function requirePro(req: Request) {
  const session = await validateSession(req);
  if (!session.valid) {
    return { authorized: false, response: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) };
  }
  if (session.plan !== 'pro') {
    return { authorized: false, response: NextResponse.json({ error: 'Plano Pro necessário' }, { status: 403 }) };
  }
  return { authorized: true, session };
}

// ── Sanitizar dados antes de retornar ao frontend ───────────────────────────
export function sanitizeUser(user: any) {
  // Nunca retornar campos sensíveis
  const { 
    password_hash, service_key, raw_user_meta_data,
    raw_app_meta_data, encrypted_password,
    confirmation_token, recovery_token, email_change_token_new,
    ...safe 
  } = user;
  return safe;
}

export function sanitizeProfile(profile: any) {
  const { ...safe } = profile;
  // Nunca expor IDs incrementais de tabelas internas
  delete safe.internal_id;
  return safe;
}

export function sanitizeGame(game: any) {
  return {
    id: game.id,
    game_date: game.game_date,
    home_team: game.home_team,
    away_team: game.away_team,
    home_team_id: game.home_team_id,
    away_team_id: game.away_team_id,
    home_logo: game.home_logo,
    away_logo: game.away_logo,
    game_time: game.game_time,
    status: game.status,
  };
}

export function sanitizePlayer(player: any) {
  return {
    id: player.id,
    name: player.name,
    team_id: player.team_id,
    position: player.position,
    jersey: player.jersey,
    photo: player.photo,
  };
}

export function sanitizeMetrics(metrics: any) {
  if (!metrics) return null;
  return {
    player_id: metrics.player_id,
    stat: metrics.stat,
    avg_l5: metrics.avg_l5,
    avg_l10: metrics.avg_l10,
    avg_l20: metrics.avg_l20,
    avg_l30: metrics.avg_l30,
    avg_season: metrics.avg_season,
    avg_home: metrics.avg_home,
    avg_away: metrics.avg_away,
    hit_rate_l10: metrics.hit_rate_l10,
    games: metrics.games,
  };
}

// ── CORS restritivo ──────────────────────────────────────────────────────────
export function corsHeaders() {
  const origin = process.env.NEXT_PUBLIC_URL || 'https://linhacash.com.br';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

// ── Criptografia AES-256-GCM para dados sensíveis ────────────────────────────
let cachedEncryptionKey: string | null = null;

function getEncryptionKey() {
  if (cachedEncryptionKey) return cachedEncryptionKey;
  cachedEncryptionKey = requireEnv('ENCRYPTION_KEY');
  return cachedEncryptionKey;
}

export function encrypt(text: string): string {
  const key = Buffer.from(getEncryptionKey().slice(0, 64), 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(text: string): string {
  const [ivHex, authTagHex, encryptedHex] = text.split(':');
  const key = Buffer.from(getEncryptionKey().slice(0, 64), 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

// ── Hash de email para analytics — nunca armazenar email puro em logs ────────
export function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 16);
}

// ── Rate limit no login — 5 falhas por IP e por email em 15 min ─────────────
export async function loginRateLimit(ip: string, email: string): Promise<boolean> {
  const byIp = await rateLimit(`login:ip:${ip}`, 5, 15 * 60 * 1000);
  const byEmail = await rateLimit(`login:email:${hashEmail(email)}`, 5, 15 * 60 * 1000);
  return byIp && byEmail;
}

// ── Validar CRON_SECRET para proteger /api/sync ──────────────────────────────
export function validateCronSecret(req: Request): boolean {
  const secret = req.headers.get('x-cron-secret') || '';
  const expected = process.env.CRON_SECRET || '';
  if (!secret || !expected) return false;
  const a = Buffer.from(secret, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ── Response helpers seguros ─────────────────────────────────────────────────
export function okResponse(data: any, status = 200) {
  return NextResponse.json(data, { 
    status,
    headers: corsHeaders()
  });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    { error: message },
    { status, headers: corsHeaders() }
  );
}
