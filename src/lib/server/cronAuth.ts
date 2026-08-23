import { HttpError } from '@/lib/server/httpError';

/**
 * Fail closed: Cron routes require Authorization: Bearer ${CRON_SECRET}.
 * Never log or return the secret.
 */
export function requireCronAuthorization(request: Request): void {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    throw new HttpError(401, 'UNAUTHORIZED');
  }
}
