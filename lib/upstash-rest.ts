const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

function isConfigured() {
  return Boolean(redisUrl && redisToken);
}

async function runPipeline(commands: Array<Array<string | number>>): Promise<Array<{ result?: unknown }> | null> {
  if (!isConfigured()) return null;
  try {
    const response = await fetch(`${redisUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redisToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
      cache: 'no-store',
    });

    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    if (!Array.isArray(data)) return null;
    return data as Array<{ result?: unknown }>;
  } catch {
    return null;
  }
}

export async function upstashGet(key: string): Promise<string | null> {
  const result = await runPipeline([['GET', key]]);
  const value = result?.[0]?.result;
  return typeof value === 'string' ? value : null;
}

export async function upstashTtl(key: string): Promise<number | null> {
  const result = await runPipeline([['TTL', key]]);
  const ttl = result?.[0]?.result;
  return typeof ttl === 'number' ? ttl : null;
}

export async function upstashSetEx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  const result = await runPipeline([['SET', key, value, 'EX', Math.max(1, Math.floor(ttlSeconds))]]);
  return result?.[0]?.result === 'OK';
}

export async function upstashSetNxEx(key: string, value: string, ttlSeconds: number): Promise<'acquired' | 'locked' | 'unavailable'> {
  const result = await runPipeline([['SET', key, value, 'NX', 'EX', Math.max(1, Math.floor(ttlSeconds))]]);
  if (!result) return 'unavailable';
  return result[0]?.result === 'OK' ? 'acquired' : 'locked';
}

export async function upstashDelete(key: string): Promise<void> {
  await runPipeline([['DEL', key]]);
}

export async function upstashDeleteIfValueMatches(key: string, expectedValue: string): Promise<void> {
  const current = await upstashGet(key);
  if (current && current === expectedValue) {
    await upstashDelete(key);
  }
}

export async function upstashDeleteByPrefix(prefix: string): Promise<void> {
  const keysResult = await runPipeline([['KEYS', `${prefix}*`]]);
  const keys = Array.isArray(keysResult?.[0]?.result) ? keysResult?.[0]?.result as string[] : [];
  if (!keys.length) return;

  const commands = keys.map((key) => ['DEL', key] as Array<string | number>);
  await runPipeline(commands);
}

export function upstashAvailable(): boolean {
  return isConfigured();
}
