import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { auditLog } from '@/lib/services/audit-log-service';
import { acquireIdempotencyKey } from '@/lib/services/idempotency-service';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

function secureCompare(a: string, b: string) {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function validateSignature(req: Request, paymentId: string): boolean {
  const signature = req.headers.get('x-signature') || '';
  const requestId = req.headers.get('x-request-id') || '';
  const ts = signature.split(',').find((part) => part.startsWith('ts='))?.split('=')[1];
  const v1 = signature.split(',').find((part) => part.startsWith('v1='))?.split('=')[1];
  if (!ts || !v1 || !requestId || !process.env.MP_WEBHOOK_SECRET) return false;

  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', process.env.MP_WEBHOOK_SECRET).update(manifest).digest('hex');
  return secureCompare(expected, v1);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const paymentId = String(body?.data?.id || '');

  try {
    if (!paymentId || body?.type !== 'payment') {
      await auditLog('webhook_event', { status: 'ignored', reason: 'not_payment_event' });
      return Response.json({ ok: true });
    }

    if (!validateSignature(req, paymentId)) {
      await auditLog('webhook_event', { status: 'denied', reason: 'invalid_signature' });
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const lockAcquired = await acquireIdempotencyKey(`mp:webhook:${paymentId}`);
    if (!lockAcquired) {
      await auditLog('webhook_event', { status: 'ignored', reason: 'idempotent_replay', paymentId });
      return Response.json({ ok: true });
    }

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      cache: 'no-store',
    });
    const payment = await response.json();

    if (payment.status !== 'approved') {
      await auditLog('webhook_event', { status: 'ignored', reason: 'payment_not_approved', paymentId });
      return Response.json({ ok: true });
    }

    const userId = payment.external_reference || payment.metadata?.user_id;
    if (!userId) {
      await auditLog('webhook_event', { status: 'failed', reason: 'missing_user_association', paymentId });
      return Response.json({ ok: true });
    }

    const referralCode = payment.metadata?.referral_code || null;
    await supabase.from('profiles').update({ plan: 'pro', referral_code_used: referralCode }).eq('id', userId);

    if (referralCode) {
      await supabase.rpc('increment_referral_use', { referral_code: referralCode }).catch(async () => {
        const { data: refData } = await supabase.from('referral_codes').select('uses').eq('code', referralCode).single();
        await supabase.from('referral_codes').update({ uses: (refData?.uses || 0) + 1 }).eq('code', referralCode);
      });
      await supabase.from('referral_uses').insert({ code: referralCode, user_id: userId, payment_id: paymentId, created_at: new Date().toISOString() });
    } else {
      await supabase.from('referral_uses').insert({ code: null, user_id: userId, payment_id: paymentId, created_at: new Date().toISOString() });
    }

    await auditLog('webhook_event', { status: 'processed', paymentId, userId });
    return Response.json({ ok: true });
  } catch {
    await auditLog('webhook_event', { status: 'failed', paymentId });
    return Response.json({ ok: true });
  }
}
