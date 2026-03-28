// Rate limiter com suporte a Upstash Redis (produção) e memória (desenvolvimento)
// Para ativar Redis: adicionar UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN na Vercel

const memoryStore = new Map<string, { count: number; resetAt: number }>();

// Rate limiter em memória (fallback se Redis não configurado)
function rateLimitMemory(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = memoryStore.get(key);
  if (!record || now > record.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (record.count >= limit) return false;
  record.count++;
  return true;
}

// Rate limiter com Upstash Redis (persistente entre deploys)
async function rateLimitRedis(key: string, limit: number, windowMs: number): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return rateLimitMemory(key, limit, windowMs);

  try {
    const windowSec = Math.ceil(windowMs / 1000);
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, windowSec]
      ])
    });
    const data = await res.json();
    const count = data[0]?.result || 1;
    return count <= limit;
  } catch {
    // Se Redis falhar, usa memória como fallback
    return rateLimitMemory(key, limit, windowMs);
  }
}

export async function rateLimit(ip: string, limit: number = 30, windowMs: number = 60000): Promise<boolean> {
  const key = `rl:${ip}:${windowMs}`;
  return rateLimitRedis(key, limit, windowMs);
}

// Versão síncrona para compatibilidade (usa só memória)
export function rateLimitSync(ip: string, limit: number = 30, windowMs: number = 60000): boolean {
  return rateLimitMemory(`${ip}:${windowMs}`, limit, windowMs);
}

export function getIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return ip;
}

// Limpa entradas antigas a cada 10 minutos
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    memoryStore.forEach((value, key) => {
      if (now > value.resetAt) memoryStore.delete(key);
    });
  }, 10 * 60 * 1000);
}
