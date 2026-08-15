import { NextResponse } from 'next/server';
import { requireSessionApi } from '@/server/auth/session';
import { listActiveOccupiedRoomCheckins } from '@/lib/server/checkinsRepo';
import { logError, logInfo } from '@/lib/server/log';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';

export const runtime = 'nodejs';

export async function GET() {
  const requestId = crypto.randomUUID();
  const started = Date.now();
  logInfo('api.checkins.active-occupied.start', { requestId });

  try {
    await requireSessionApi();
    const checkins = await listActiveOccupiedRoomCheckins();
    logInfo('api.checkins.active-occupied.complete', {
      requestId,
      docsReturned: checkins.length,
      durationMs: Date.now() - started,
    });
    return NextResponse.json({ checkins });
  } catch (err) {
    const httpErr =
      err instanceof HttpError
        ? err
        : err instanceof Error && err.message === 'Not authenticated'
          ? new HttpError(401, 'UNAUTHORIZED')
          : new HttpError(500, 'LIST_FAILED');
    logError('api.checkins.active-occupied.error', { requestId, message: String(err) });
    const { status, body } = toErrorResponse(httpErr, requestId);
    return NextResponse.json(body, { status });
  }
}
