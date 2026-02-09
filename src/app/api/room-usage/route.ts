import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth/session';
import { getRoomUsageTop15 } from '@/lib/server/checkinsRepo';
import { logError, logInfo } from '@/lib/server/log';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';
import { requireEnvs } from '@/lib/server/requireEnv';

export const runtime = 'nodejs';

export async function GET() {
  const requestId = crypto.randomUUID();
  logInfo('api.room-usage.start', { requestId });

  try {
    if (process.env.NODE_ENV === 'production') {
      requireEnvs(['SESSION_SECRET']);
    }
    await requireAuth('admin');
    const data = await getRoomUsageTop15();
    return NextResponse.json(data);
  } catch (err) {
    const error = err instanceof HttpError ? err : new HttpError(401, 'UNAUTHORIZED');
    logError('api.room-usage.error', { requestId, message: String(err) });
    const { status, body } = toErrorResponse(error, requestId);
    return NextResponse.json(body, { status });
  }
}
