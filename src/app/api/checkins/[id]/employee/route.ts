import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { requireSessionApi } from '@/server/auth/session';
import {
  checkinOwnedByEmployee,
  employeeUpdateRoomOperational,
  isWithinEmployeeEditHours,
  updateCheckinFoodBeer,
} from '@/lib/server/checkinsRepo';
import {
  validateEmployeeOperationalFoodBeer,
  validateEmployeeOperationalRoom,
} from '@/lib/checkins/validation/updateCheckin';
import { normalizeReceipt } from '@/lib/checkins/validation/room';
import { isEmployeeRoomNumberLockedForCompletedStayDoc } from '@/lib/checkins/roomOccupancy';
import { Timestamp } from 'firebase-admin/firestore';
import { HttpError } from '@/lib/server/httpError';
import { logError } from '@/lib/server/log';

const CHECKINS_COLLECTION = 'checkins';

export const runtime = 'nodejs';

/**
 * Employee self-service update: own records only, within rolling edit window.
 * Room: payment splits + vehicle + notes. Food/beer: item + qty + amount + notes.
 * Does not change receipt #, staff attribution, or check-in type. Room number may be corrected only for room stays that are not fully checked out and cleaned.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSessionApi();
    if (session.role !== 'employee') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing check-in id' }, { status: 400 });
    }

    const db = getAdminDb();
    const docSnap = await db.collection(CHECKINS_COLLECTION).doc(id).get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Check-in not found' }, { status: 404 });
    }

    const raw = docSnap.data()!;
    if (
      !checkinOwnedByEmployee(raw, {
        userId: session.userId,
        username: session.username ?? '',
      })
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!isWithinEmployeeEditHours(raw)) {
      return NextResponse.json({ error: 'Edit window expired' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const checkInType = (raw.checkInType as string) ?? 'room';
    const editedBy = session.username?.trim() || 'employee';

    if (checkInType === 'room') {
      const roomLocked = isEmployeeRoomNumberLockedForCompletedStayDoc(raw);
      const bodyObj =
        typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
      const mergedRoomBody = roomLocked
        ? {
            ...bodyObj,
            room_id:
              raw.roomId != null && raw.roomId !== ''
                ? raw.roomId
                : (bodyObj.room_id as string | number | undefined),
          }
        : bodyObj;
      const validation = validateEmployeeOperationalRoom(mergedRoomBody);
      if (!validation.valid || !validation.payment_splits || validation.room_id === undefined) {
        return NextResponse.json(
          {
            error: Object.values(validation.errors).find(Boolean) ?? 'Validation failed',
            fieldErrors: validation.errors,
          },
          { status: 400 }
        );
      }
      await employeeUpdateRoomOperational(
        id,
        {
          payment_splits: validation.payment_splits,
          room_id: validation.room_id,
          car_plate: String(body.car_plate ?? ''),
          car_make: String(body.car_make ?? ''),
          car_color: String(body.car_color ?? ''),
          note: body.note != null ? String(body.note) : undefined,
        },
        editedBy
      );
      return NextResponse.json({ ok: true });
    }

    if (checkInType === 'food' || checkInType === 'beer') {
      const v = validateEmployeeOperationalFoodBeer(body as Record<string, unknown>);
      if (!v.valid) {
        return NextResponse.json(
          {
            error: Object.values(v.errors).find(Boolean) ?? 'Validation failed',
            fieldErrors: v.errors,
          },
          { status: 400 }
        );
      }

      const receiptRaw = String(raw.receiptNumber ?? raw.receiptNo ?? '');
      const padded = normalizeReceipt(receiptRaw);
      if (padded === null) {
        return NextResponse.json({ error: 'Invalid receipt on record' }, { status: 400 });
      }

      const staffName = String(raw.staffName ?? '').trim();
      const itemId = String(body.itemId ?? '').trim();
      const itemLabel =
        body.itemLabel != null ? String(body.itemLabel).trim() : itemId;
      const quantity = Math.floor(Number(body.quantity));
      const amountCollected = Number(body.amountCollected);

      await updateCheckinFoodBeer(
        id,
        {
          receipt_number: padded,
          staff_name: staffName,
          itemId,
          itemLabel,
          quantity,
          amountCollected,
        },
        editedBy
      );

      const notesTrim = body.notes != null ? String(body.notes).trim().slice(0, 250) : '';
      const prevNote = typeof raw.note === 'string' ? raw.note.trim() : '';
      if (notesTrim !== prevNote) {
        await db.collection(CHECKINS_COLLECTION).doc(id).update({
          note: notesTrim,
          updatedAt: Timestamp.now(),
          updatedBy: editedBy,
        });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unsupported check-in type' }, { status: 400 });
  } catch (err) {
    logError('api.checkins.employee.patch', { message: String(err) });
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Update failed' }, { status: 500 });
  }
}
