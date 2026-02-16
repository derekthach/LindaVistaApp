import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth/session';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { deleteCheckinById } from '@/lib/server/checkinsRepo';
import { logError, logInfo } from '@/lib/server/log';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';

export const runtime = 'nodejs';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  logInfo('api.checkins.delete.start', { requestId });

  try {
    await requireAuth('admin');
    await requireAdmin(_request);
    const { id } = await params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid id' }, { status: 400 });
    }
    await deleteCheckinById(id);
    logInfo('api.checkins.delete.success', { requestId, id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const httpErr =
      err instanceof HttpError
        ? err
        : err instanceof Error && err.message === 'Not authenticated'
          ? new HttpError(401, 'UNAUTHORIZED')
          : err instanceof Error && err.message === 'Insufficient permissions'
            ? new HttpError(403, 'FORBIDDEN')
            : new HttpError(500, 'DELETE_FAILED');
    logError('api.checkins.delete.error', { requestId, message: String(err) });
    const { status, body } = toErrorResponse(httpErr, requestId);
    return NextResponse.json(body, { status });
  }
}
