import { NextRequest, NextResponse } from 'next/server';
import { requireSessionApi } from '@/server/auth/session';
import { checkoutRoomCheckin } from '@/lib/server/checkinsRepo';
import { STAFF_MEMBERS } from '@/lib/checkins/constants';
import { buildCheckoutStaffSet } from '@/lib/server/checkoutStaffAllowlist';
import { isGuestEmployeeUsername } from '@/lib/auth/guestEmployee';
import { logError, logInfo } from '@/lib/server/log';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';

export const runtime = 'nodejs';
const GUEST_STAFF_NAME_MAX = 80;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  logInfo('api.checkins.checkout.start', { requestId });

  try {
    const session = await requireSessionApi();
    const { id } = await params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing check-in id' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    let cleanedBy =
      typeof body.cleanedBy === 'string' ? body.cleanedBy.trim() : '';
    const guestEmployee = session.role === 'employee' && isGuestEmployeeUsername(session.username);
    if (session.role === 'employee' && !guestEmployee) {
      cleanedBy = (session.displayName ?? session.username).trim();
    }
    if (!cleanedBy) {
      return NextResponse.json({ error: 'Cleaner staff is required' }, { status: 400 });
    }
    if (guestEmployee) {
      if (cleanedBy.length > GUEST_STAFF_NAME_MAX) {
        return NextResponse.json({ error: 'Staff name is too long' }, { status: 400 });
      }
    } else {
      let staffSet: Set<string>;
      try {
        staffSet = await buildCheckoutStaffSet();
      } catch (err) {
        console.error('[checkout] staff allowlist merge failed; using legacy STAFF_MEMBERS only', err);
        staffSet = new Set<string>(STAFF_MEMBERS);
      }
      if (!staffSet.has(cleanedBy)) {
        return NextResponse.json({ error: 'Invalid staff selection' }, { status: 400 });
      }
    }

    const performedBy = guestEmployee ? cleanedBy : session.username?.trim() || cleanedBy;

    await checkoutRoomCheckin(id, { cleanedBy, performedBy });
    logInfo('api.checkins.checkout.success', { requestId, id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const httpErr =
      err instanceof HttpError
        ? err
        : err instanceof Error && err.message === 'Not authenticated'
          ? new HttpError(401, 'UNAUTHORIZED')
          : msg === 'Check-in not found'
            ? new HttpError(404, 'NOT_FOUND')
            : msg === 'Check-in is not a room record'
              ? new HttpError(400, 'BAD_REQUEST')
              : msg === 'Room already checked out'
                ? new HttpError(409, 'CONFLICT')
                : msg === 'Past entries do not require checkout'
                  ? new HttpError(400, 'BAD_REQUEST')
                  : new HttpError(500, 'CHECKOUT_FAILED');
    logError('api.checkins.checkout.error', { requestId, message: String(err) });
    const { status, body } = toErrorResponse(httpErr, requestId);
    return NextResponse.json({ ...body, error: msg }, { status });
  }
}
