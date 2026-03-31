import { ValidationError } from '@/lib/http/errors';

export function ensureObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('Invalid request body');
  }
  return input as Record<string, unknown>;
}

export function asString(value: unknown, field: string, max = 255): string {
  if (typeof value !== 'string') throw new ValidationError(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new ValidationError(`${field} is required`);
  if (normalized.length > max) throw new ValidationError(`${field} is too long`);
  return normalized;
}

export function asEmail(value: unknown, field = 'email'): string {
  const email = asString(value, field, 320).toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) throw new ValidationError('Invalid email address');
  return email;
}

export function asUUID(value: unknown, field: string): string {
  const id = asString(value, field, 64);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) throw new ValidationError(`${field} must be a valid UUID`);
  return id;
}

export function asEnum<T extends readonly string[]>(value: unknown, field: string, allowed: T): T[number] {
  const normalized = asString(value, field, 32);
  if (!allowed.includes(normalized)) throw new ValidationError(`${field} is invalid`);
  return normalized as T[number];
}

export function asNumber(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new ValidationError(`${field} must be a valid number`);
  return parsed;
}
