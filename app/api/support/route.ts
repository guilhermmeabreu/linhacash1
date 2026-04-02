import { emailConfirmacaoSuporte, emailSuporte, sendEmail } from '@/lib/emails';
import { AppError } from '@/lib/http/errors';
import { fail, internalError, ok, options } from '@/lib/http/responses';
import { getIP, rateLimit } from '@/lib/rate-limit';
import { validateSupportPayload } from '@/lib/validators/auth-validator';
import { requireAuthenticatedUser } from '@/lib/auth/authorization';
import { assertAllowedOrigin, readJsonObject } from '@/lib/http/request-guards';
import { auditLog } from '@/lib/services/audit-log-service';

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  try {
    assertAllowedOrigin(req);
    const ip = getIP(req);
    if (!(await rateLimit(`support:${ip}`, 3, 60 * 60_000))) {
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many support requests'), origin);
    }

    const user = await requireAuthenticatedUser(req);
    const { subject, message } = validateSupportPayload(await readJsonObject(req));
    const name = user.name || 'Usuário';
    const email = user.email;
    await sendEmail(process.env.ADMIN_EMAIL!, emailSuporte(name, email, subject, message), email);
    await sendEmail(email, emailConfirmacaoSuporte(name, message));
    await auditLog('support_message_sent', { userId: user.id, subject });

    return ok({ sent: true });
  } catch (error) {
    if (error instanceof AppError) return fail(error, origin);
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
