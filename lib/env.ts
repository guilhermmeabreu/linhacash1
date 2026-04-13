const REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
] as const;

type EnvKey = (typeof REQUIRED_ENV)[number];

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function requireEnv(name: EnvKey | string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function validateCriticalEnv() {
  REQUIRED_ENV.forEach((key) => {
    requireEnv(key);
  });
}

export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

export function isDebugMode() {
  const override = process.env.DEBUG_API_ERRORS || process.env.STRIPE_DEBUG_ERRORS;
  if (typeof override === 'string') {
    const normalized = override.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
      return true;
    }
    if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
      return false;
    }
  }

  return !isProduction();
}
