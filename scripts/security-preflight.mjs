const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'JWT_SECRET'];
const recommended = ['ADMIN_SESSION_SECRET', 'ADMIN_TOTP_SECRET', 'ENCRYPTION_KEY'];

const missingRequired = required.filter((key) => !process.env[key] || !process.env[key].trim());
const missingRecommended = recommended.filter((key) => !process.env[key] || !process.env[key].trim());

const isProduction = process.env.NODE_ENV === 'production';
const allowPasswordOnlyAdmin = process.env.ADMIN_ALLOW_PASSWORD_ONLY === 'true';
const strictReadiness = process.env.SECURITY_READINESS_STRICT === 'true';

function printList(title, items) {
  if (!items.length) return;
  console.log(`- ${title}: ${items.join(', ')}`);
}

if (missingRequired.length) {
  console.error('[SECURITY] Missing required environment variables.');
  printList('required', missingRequired);
  process.exit(1);
}

if (missingRecommended.length) {
  console.warn('[SECURITY] Missing recommended security environment variables.');
  printList('recommended', missingRecommended);
}

if (isProduction && missingRecommended.includes('ADMIN_TOTP_SECRET') && !allowPasswordOnlyAdmin) {
  console.warn('[SECURITY] Admin password-only mode is disabled, but ADMIN_TOTP_SECRET is missing.');
}

if (strictReadiness && isProduction && missingRecommended.length) {
  console.error('[SECURITY] SECURITY_READINESS_STRICT=true and recommended security envs are missing.');
  process.exit(1);
}

console.log('[SECURITY] Preflight completed.');
