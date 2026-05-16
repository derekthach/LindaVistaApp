import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { requireAuth } from '@/server/auth/session';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { adminApplyCheckinPatch, deleteCheckinById } from '@/lib/server/checkinsRepo';
import { getMergedCheckoutStaffDisplayNames } from '@/lib/server/checkoutStaffAllowlist';
import { logError, logInfo } from '@/lib/server/log';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';

const CHECKINS_COLLECTION = 'checkins';

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

function isLikelyValidationOrClientMessage(message: string): boolean {
  return /validation|must|invalid|required|allowed list|digits|whole number|cannot be changed/i.test(
    message
  );
}

/**
 * Admin PATCH: editable fields only; check-in type is fixed from the Firestore document.
 * Persists Puerto Rico wall time + notes + type-specific totals.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  logInfo('api.checkins.patch.start', { requestId });

  try {
    await requireAuth('admin');
    const { id } = await params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid id' }, { status: 400 });
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const db = getAdminDb();
    const docSnap = await db.collection(CHECKINS_COLLECTION).doc(id).get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Check-in not found' }, { status: 404 });
    }

    let staffAllowlist: string[] | undefined;
    try {
      staffAllowlist = await getMergedCheckoutStaffDisplayNames();
    } catch {
      staffAllowlist = undefined;
    }

    const editedBy = typeof body.staff_name === 'string' ? body.staff_name.trim() : '';

    await adminApplyCheckinPatch(id, body, editedBy, staffAllowlist);

    logInfo('api.checkins.patch.success', { requestId, id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message && isLikelyValidationOrClientMessage(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const httpErr =
      err instanceof HttpError
        ? err
        : err instanceof Error && err.message === 'Not authenticated'
          ? new HttpError(401, 'UNAUTHORIZED')
          : err instanceof Error && err.message === 'Insufficient permissions'
            ? new HttpError(403, 'FORBIDDEN')
            : new HttpError(500, 'UPDATE_FAILED', {
                message: err instanceof Error ? err.message : String(err),
              });
    logError('api.checkins.patch.error', { requestId, message: String(err) });
    const { status, body } = toErrorResponse(httpErr, requestId);
    const responseBody = status === 500 && err instanceof Error ? { ...body, error: err.message } : body;
    return NextResponse.json(responseBody, { status });
  }
}
