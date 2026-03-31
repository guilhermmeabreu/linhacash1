import crypto from 'crypto';
import { acquireIdempotencyKey } from '@/lib/services/idempotency-service';

const WINDOW_STEPS = 1;
const STEP_SECONDS = 30;
const DIGITS = 6;

function normalizeBase32(input: string): string {
  return input.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
}

function base32ToBuffer(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of normalizeBase32(base32)) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error('Invalid TOTP secret encoding');
    bits += index.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function totpAt(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(code % 10 ** DIGITS).padStart(DIGITS, '0');
}

function safeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function verifyTotpCode(secretBase32: string, userCode: string): boolean {
  const normalizedCode = userCode.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalizedCode)) return false;

  const secret = base32ToBuffer(secretBase32);
  const nowCounter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (let drift = -WINDOW_STEPS; drift <= WINDOW_STEPS; drift += 1) {
    const expected = totpAt(secret, nowCounter + drift);
    if (safeCompare(expected, normalizedCode)) {
      return true;
    }
  }

  return false;
}

function hashRecoveryCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

export async function consumeRecoveryCode(rawCode: string): Promise<boolean> {
  const configured = (process.env.ADMIN_2FA_RECOVERY_CODE_HASHES || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!configured.length) return false;

  const candidate = hashRecoveryCode(rawCode);
  if (!configured.some((hash) => safeCompare(hash, candidate))) {
    return false;
  }

  return acquireIdempotencyKey(`admin:recovery-code:${candidate}`, 60 * 60 * 24 * 365);
}
