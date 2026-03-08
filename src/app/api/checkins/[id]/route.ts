import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { requireAuth } from '@/server/auth/session';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { deleteCheckinById, updateCheckin, updateCheckinFoodBeer } from '@/lib/server/checkinsRepo';
import { validateUpdateCheckin, validateUpdateFoodBeerCheckin } from '@/lib/checkins/validation/updateCheckin';
import { normalizeReceipt } from '@/lib/checkins/validation/room';
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
        cost: body.cost,
        room_id: body.room_id,
      };
      const validation = validateUpdateCheckin(raw as Record<string, unknown>, true);
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
        cost: Number(raw.cost),
        room_id: raw.room_id as number | string,
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
