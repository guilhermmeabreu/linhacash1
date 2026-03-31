import { emailConfirmacaoSuporte, emailSuporte, sendEmail } from '@/lib/emails';
import { AppError } from '@/lib/http/errors';
import { fail, internalError, ok, options } from '@/lib/http/responses';
import { getIP, rateLimit } from '@/lib/rate-limit';
import { validateSupportPayload } from '@/lib/validators/auth-validator';

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  try {
    const ip = getIP(req);
    if (!(await rateLimit(`support:${ip}`, 3, 60 * 60_000))) {
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many support requests'), origin);
    }

    const { name, email, subject, message } = validateSupportPayload(await req.json());
    await sendEmail(process.env.ADMIN_EMAIL!, emailSuporte(name, email, subject, message), email);
    await sendEmail(email, emailConfirmacaoSuporte(name, message));

    return ok({ sent: true });
  } catch (error) {
    if (error instanceof AppError) return fail(error, origin);
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
