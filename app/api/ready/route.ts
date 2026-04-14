import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { logRouteError } from '@/lib/observability';

export const runtime = 'nodejs';

const REQUIRED_ENV_VARS = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'JWT_SECRET'] as const;

function missingRequiredEnv(): string[] {
  return REQUIRED_ENV_VARS.filter((key) => !process.env[key] || !process.env[key]?.trim());
}

export async function GET() {
  const missingEnv = missingRequiredEnv();

  if (missingEnv.length > 0) {
    logRouteError('/api/ready', crypto.randomUUID(), new Error('Missing required environment variables'), {
      status: 503,
      errorCode: 'READINESS_ENV_MISSING',
      provider: 'runtime',
      missingCount: missingEnv.length,
    });

    return Response.json({ status: 'not_ready' }, { status: 503 });
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

    return Response.json({ status: 'ready' }, { status: 200 });
  } catch (error) {
    logRouteError('/api/ready', crypto.randomUUID(), error, {
      status: 503,
      provider: 'supabase',
    });

    return Response.json({ status: 'not_ready' }, { status: 503 });
  }
}
