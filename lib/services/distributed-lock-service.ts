import crypto from 'crypto';

const memoryLocks = new Map<string, { token: string; expiresAt: number }>();

function now() {
  return Date.now();
}

function cleanupMemoryLocks() {
  const timestamp = now();
  for (const [key, value] of memoryLocks.entries()) {
    if (value.expiresAt <= timestamp) memoryLocks.delete(key);
  }
}

type LockHandle = {
  key: string;
  token: string;
};

export async function acquireDistributedLock(key: string, ttlSeconds: number): Promise<LockHandle | null> {
  const token = crypto.randomUUID();
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    const response = await fetch(
      `${redisUrl}/set/${encodeURIComponent(key)}/${encodeURIComponent(token)}?NX=true&EX=${ttlSeconds}`,
      {
        headers: { Authorization: `Bearer ${redisToken}` },
        cache: 'no-store',
      }
    );
    const data = await response.json().catch(() => null);
    if (data?.result === 'OK') return { key, token };
    return null;
  }

  cleanupMemoryLocks();
  const existing = memoryLocks.get(key);
  if (existing && existing.expiresAt > now()) return null;
  memoryLocks.set(key, { token, expiresAt: now() + ttlSeconds * 1000 });
  return { key, token };
}

export async function releaseDistributedLock(lock: LockHandle | null): Promise<void> {
  if (!lock) return;

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    const getResponse = await fetch(`${redisUrl}/get/${encodeURIComponent(lock.key)}`, {
      headers: { Authorization: `Bearer ${redisToken}` },
      cache: 'no-store',
    });
    const getData = await getResponse.json().catch(() => null);
    if (getData?.result !== lock.token) return;

    await fetch(`${redisUrl}/del/${encodeURIComponent(lock.key)}`, {
      headers: { Authorization: `Bearer ${redisToken}` },
      cache: 'no-store',
    });
    return;
  }

  cleanupMemoryLocks();
  const existing = memoryLocks.get(lock.key);
  if (existing?.token === lock.token) memoryLocks.delete(lock.key);
}
