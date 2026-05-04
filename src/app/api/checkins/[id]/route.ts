import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { requireAuth } from '@/server/auth/session';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { deleteCheckinById, updateCheckin, updateCheckinFoodBeer } from '@/lib/server/checkinsRepo';
import { validateUpdateCheckin, validateUpdateFoodBeerCheckin } from '@/lib/checkins/validation/updateCheckin';
import { normalizeReceipt } from '@/lib/checkins/validation/room';
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

/**
 * Admin update check-in. Room: receipt, staff, cost, room. Food/Beer: receipt, staff, item, quantity, amountCollected.
 * Manual QA: Edit FOOD: change item, quantity, amountCollected; confirm diff; save; dashboard totals update.
 * Edit BEER: same. Audit history created. checkInAt unchanged. Receipt duplicates allowed. CSV uses latest values.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  logInfo('api.checkins.patch.start', { requestId });

  try {
    await requireAuth('admin');
    const { id } = await params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid id' }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const db = getAdminDb();
    const docSnap = await db.collection(CHECKINS_COLLECTION).doc(id).get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Check-in not found' }, { status: 404 });
    }
    const checkInType = (docSnap.data()?.checkInType as string) ?? 'room';
    const isRoom = checkInType === 'room';

    if (isRoom) {
      const raw = {
        receipt_number: body.receipt_number,
        staff_name: body.staff_name,
        room_id: body.room_id,
        payment_splits: body.payment_splits,
      };
      const isPastEntry = docSnap.data()?.isPastEntry === true;
      let staffAllowlist: string[] | undefined;
      try {
        staffAllowlist = await getMergedCheckoutStaffDisplayNames();
      } catch {
        staffAllowlist = undefined;
      }
      const validation = validateUpdateCheckin(raw as Record<string, unknown>, true, {
        ...(staffAllowlist && staffAllowlist.length > 0 ? { staffAllowlist } : {}),
      });
      if (!validation.valid || !validation.payment_splits) {
        return NextResponse.json(
          { error: Object.values(validation.errors).find(Boolean) ?? 'Validation failed', fieldErrors: validation.errors },
          { status: 400 }
        );
      }
      const receiptPadded = normalizeReceipt(String(raw.receipt_number ?? ''))!;
      const checkInDate =
        typeof body.check_in_date === 'string' ? body.check_in_date.trim() : '';
      const checkInTime =
        typeof body.check_in_time === 'string' ? body.check_in_time.trim() : '';
      if (isPastEntry && (checkInDate || checkInTime)) {
        const timeOk = /^\d{2}:\d{2}(:\d{2})?$/.test(checkInTime);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(checkInDate) || !timeOk) {
          return NextResponse.json(
            { error: 'Invalid check-in date or time for past entry' },
            { status: 400 }
          );
        }
      }
      const payload = {
        receipt_number: receiptPadded,
        staff_name: String(raw.staff_name).trim(),
        room_id: raw.room_id as number | string,
        payment_splits: validation.payment_splits,
        ...(isPastEntry && checkInDate && checkInTime
          ? { check_in_date: checkInDate, check_in_time: checkInTime }
          : {}),
      };
      await updateCheckin(id, payload, payload.staff_name);
    } else {
      const raw = {
        receipt_number: body.receipt_number,
        staff_name: body.staff_name,
        itemId: body.itemId,
        itemLabel: body.itemLabel,
        quantity: body.quantity,
        amountCollected: body.amountCollected,
      };
      const validation = validateUpdateFoodBeerCheckin(raw as Record<string, unknown>);
      if (!validation.valid) {
        return NextResponse.json(
          { error: Object.values(validation.errors).find(Boolean) ?? 'Validation failed', fieldErrors: validation.errors },
          { status: 400 }
        );
      }
      const receiptPadded = normalizeReceipt(String(raw.receipt_number ?? ''))!;
      const payload = {
        receipt_number: receiptPadded,
        staff_name: String(raw.staff_name).trim(),
        itemId: String(raw.itemId).trim(),
        itemLabel: raw.itemLabel != null ? String(raw.itemLabel).trim() : String(raw.itemId).trim(),
        quantity: Math.floor(Number(raw.quantity)),
        amountCollected: Number(raw.amountCollected),
      };
      await updateCheckinFoodBeer(id, payload, payload.staff_name);
    }
    logInfo('api.checkins.patch.success', { requestId, id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const httpErr =
      err instanceof HttpError
        ? err
        : err instanceof Error && err.message === 'Not authenticated'
          ? new HttpError(401, 'UNAUTHORIZED')
          : err instanceof Error && err.message === 'Insufficient permissions'
            ? new HttpError(403, 'FORBIDDEN')
            : new HttpError(500, 'UPDATE_FAILED', { message: err instanceof Error ? err.message : String(err) });
    logError('api.checkins.patch.error', { requestId, message: String(err) });
    const { status, body } = toErrorResponse(httpErr, requestId);
    const responseBody = status === 500 && err instanceof Error ? { ...body, error: err.message } : body;
    return NextResponse.json(responseBody, { status });
  }
}
