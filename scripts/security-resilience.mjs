#!/usr/bin/env node
/**
 * Defensive resilience script for owner-operated environments only.
 * Usage:
 *   node scripts/security-resilience.mjs --baseUrl http://localhost:3000 --token <jwt>
 */

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, arg, idx, arr) => {
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    const next = arr[idx + 1];
    acc.push([key, next && !next.startsWith('--') ? next : 'true']);
  }
  return acc;
}, []));

const baseUrl = (args.baseUrl || process.env.RESILIENCE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const token = args.token || process.env.RESILIENCE_AUTH_TOKEN || '';
const email = args.email || process.env.RESILIENCE_LOGIN_EMAIL || 'security-test@example.com';
const password = args.password || process.env.RESILIENCE_LOGIN_PASSWORD || 'invalid-password';
const concurrency = Number(args.concurrency || 25);
const rounds = Number(args.rounds || 2);

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function timedFetch(label, requestFactory) {
  const started = Date.now();
  try {
    const res = await requestFactory();
    const ms = Date.now() - started;
    return { label, ok: res.ok, status: res.status, ms };
  } catch {
    return { label, ok: false, status: 'network_error', ms: Date.now() - started };
  }
}

async function runScenario(name, fn) {
  const results = [];
  for (let round = 0; round < rounds; round++) {
    const batch = await Promise.all(Array.from({ length: concurrency }, () => fn()));
    results.push(...batch);
  }

  const byStatus = new Map();
  for (const r of results) {
    byStatus.set(String(r.status), (byStatus.get(String(r.status)) || 0) + 1);
  }

  const avgMs = Math.round(results.reduce((sum, r) => sum + r.ms, 0) / Math.max(results.length, 1));
  const pct429 = Math.round((results.filter((r) => String(r.status) === '429').length / Math.max(results.length, 1)) * 100);

  return {
    name,
    total: results.length,
    avgMs,
    pct429,
    statuses: Object.fromEntries([...byStatus.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))),
  };
}

async function main() {
  console.log(`Running defensive resilience checks against ${baseUrl}`);
  console.log('Use only in local/staging environments you own.');

  const scenarios = [
    runScenario('authenticated /api/games', () => timedFetch('games', () => fetch(`${baseUrl}/api/games`, { headers: authHeaders() }))),
    runScenario('authenticated /api/metrics', () => timedFetch('metrics', () => fetch(`${baseUrl}/api/metrics?playerId=1&stat=PTS`, { headers: authHeaders() }))),
    runScenario('login burst invalid credentials', () => timedFetch('login', () => fetch(`${baseUrl}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', email, password }),
    }))),
    runScenario('checkout burst (auth required)', () => timedFetch('checkout', () => fetch(`${baseUrl}/api/checkout`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ plan: 'mensal' }),
    }))),
    runScenario('support burst (auth required)', () => timedFetch('support', () => fetch(`${baseUrl}/api/support`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ subject: 'Resilience test', message: 'Safe load test message' }),
    }))),
    runScenario('protected route without auth', () => timedFetch('noauth-games', () => fetch(`${baseUrl}/api/games`))),
    runScenario('webhook replay-like invalid signature', () => timedFetch('webhook-invalid', () => fetch(`${baseUrl}/api/webhook/mp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-signature': 'ts=1,v1=invalid', 'x-request-id': crypto.randomUUID() },
      body: JSON.stringify({ type: 'payment', data: { id: '12345678' } }),
    }))),
  ];

  const reports = await Promise.all(scenarios);
  console.table(reports.map((r) => ({ scenario: r.name, total: r.total, avg_ms: r.avgMs, rate_limited_pct: `${r.pct429}%` })));
  for (const report of reports) {
    console.log(`\n[${report.name}] status distribution`);
    console.table(report.statuses);
  }
}

import crypto from 'crypto';
main().catch((err) => {
  console.error('Resilience script failed', err);
  process.exit(1);
});
