import { ValidationError } from '@/lib/http/errors';
import { asEmail, asString, ensureObject } from '@/lib/validators/common';

export function validateAdminLogin(body: unknown) {
  const input = ensureObject(body);
  return {
    email: asEmail(input.email),
    password: asString(input.password, 'password', 256),
  };
}

export function validateSupportPayload(body: unknown) {
  const input = ensureObject(body);
  return {
    name: asString(input.name, 'name', 120),
    email: asEmail(input.email),
    subject: typeof input.subject === 'string' ? input.subject.trim().slice(0, 160) : 'Sem assunto',
    message: asString(input.message, 'message', 2000),
  };
}

export function validateCheckoutPayload(body: unknown) {
  const input = ensureObject(body);
  const plan = asString(input.plan, 'plan', 12);
  if (!['mensal', 'anual'].includes(plan)) throw new ValidationError('plan is invalid');
  const referral = typeof input.referral_code === 'string' ? input.referral_code.trim().toUpperCase() : null;
  return { plan: plan as 'mensal' | 'anual', referralCode: referral && /^[A-Z0-9]{2,20}$/.test(referral) ? referral : null };
}
