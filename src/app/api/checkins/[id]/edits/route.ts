import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth/session';
import { getCheckinEdits } from '@/lib/server/checkinsRepo';
import { logError, logInfo } from '@/lib/server/log';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';

export const runtime = 'nodejs';

/**
 * GET edit history for a check-in (checkins/{id}/edits). Auth required.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  logInfo('api.checkins.edits.get.start', { requestId });

  try {
    await requireAuth();
    const { id } = await params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid id' }, { status: 400 });
    }
    const edits = await getCheckinEdits(id);
    logInfo('api.checkins.edits.get.success', { requestId, id, count: edits.length });
    return NextResponse.json(edits);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('api.checkins.edits.get.error', { requestId, message });
    const httpErr =
      err instanceof HttpError
        ? err
        : message === 'Not authenticated'
          ? new HttpError(401, 'UNAUTHORIZED')
          : new HttpError(500, 'EDIT_HISTORY_FAILED', { message });
    const { status, body } = toErrorResponse(httpErr, requestId);
    return NextResponse.json(body, { status });
  }
}
