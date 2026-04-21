import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { logRouteError } from '@/lib/observability';

export const runtime = 'nodejs';

const REQUIRED_ENV_VARS = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'JWT_SECRET'] as const;
const RECOMMENDED_SECURITY_ENV_VARS = ['ADMIN_SESSION_SECRET', 'ADMIN_TOTP_SECRET', 'ENCRYPTION_KEY'] as const;

function missingRequiredEnv(): string[] {
  return REQUIRED_ENV_VARS.filter((key) => !process.env[key] || !process.env[key]?.trim());
}

function missingRecommendedSecurityEnv(): string[] {
  return RECOMMENDED_SECURITY_ENV_VARS.filter((key) => !process.env[key] || !process.env[key]?.trim());
}

export async function GET() {
  const missingEnv = missingRequiredEnv();
  const missingSecurityEnv = missingRecommendedSecurityEnv();
  const strictSecurityReadiness = process.env.SECURITY_READINESS_STRICT === 'true';

  if (missingEnv.length > 0) {
    logRouteError('/api/ready', crypto.randomUUID(), new Error('Missing required environment variables'), {
      status: 503,
      errorCode: 'READINESS_ENV_MISSING',
      provider: 'runtime',
      missingCount: missingEnv.length,
    });

    return Response.json({ status: 'not_ready' }, { status: 503 });
  }

  if (process.env.NODE_ENV === 'production' && missingSecurityEnv.length > 0 && strictSecurityReadiness) {
    logRouteError('/api/ready', crypto.randomUUID(), new Error('Missing recommended security environment variables in strict mode'), {
      status: 503,
      errorCode: 'READINESS_SECURITY_ENV_MISSING',
      provider: 'runtime',
      missingCount: missingSecurityEnv.length,
    });

    return Response.json({ status: 'not_ready', reason: 'security_env_missing' }, { status: 503 });
  }

  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await supabase.from('profiles').select('id').limit(1);

    if (error) {
      logRouteError('/api/ready', crypto.randomUUID(), error, {
        status: 503,
        provider: 'supabase',
      });

      return Response.json({ status: 'not_ready' }, { status: 503 });
    }

    const status = process.env.NODE_ENV === 'production' && missingSecurityEnv.length > 0 ? 'ready_with_warnings' : 'ready';
    return Response.json(
      {
        status,
        ...(status === 'ready_with_warnings' ? { warnings: { missingSecurityEnv } } : {}),
      },
      { status: 200 }
    );
  } catch (error) {
    logRouteError('/api/ready', crypto.randomUUID(), error, {
      status: 503,
      provider: 'supabase',
    });

    return Response.json({ status: 'not_ready' }, { status: 503 });
  }
}
