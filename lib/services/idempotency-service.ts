const memory = new Map<string, number>();

function now() {
  return Date.now();
}

function cleanup() {
  const ts = now();
  for (const [k, exp] of memory.entries()) {
    if (exp <= ts) memory.delete(k);
  }
}

export async function acquireIdempotencyKey(key: string, ttlSeconds = 60 * 60 * 24): Promise<boolean> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    const response = await fetch(`${redisUrl}/set/${encodeURIComponent(key)}/1?NX=true&EX=${ttlSeconds}`, {
      headers: { Authorization: `Bearer ${redisToken}` },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null);
    return data?.result === 'OK';
  }

  cleanup();
  if (memory.has(key)) return false;
  memory.set(key, now() + ttlSeconds * 1000);
  return true;
}
