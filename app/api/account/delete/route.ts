import { AppError } from '@/lib/http/errors';
import { fail, internalError, ok, options } from '@/lib/http/responses';
import { requireAuthenticatedUser } from '@/lib/auth/authorization';
import { deleteOwnAccount } from '@/lib/services/account-service';
import { getIP, rateLimit } from '@/lib/rate-limit';

export async function DELETE(req: Request) {
  const origin = req.headers.get('origin') || undefined;
  try {
    const ip = getIP(req);
    if (!(await rateLimit(`account-delete:${ip}`, 3, 60 * 60_000))) {
      return fail(new AppError('RATE_LIMIT_ERROR', 429, 'Too many account deletion attempts'), origin);
    }

    const user = await requireAuthenticatedUser(req);
    await deleteOwnAccount(user.id, user.email);
    return ok({ deleted: true });
  } catch (error) {
    if (error instanceof AppError) return fail(error, origin);
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
