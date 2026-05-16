'use server';

import { redirect } from 'next/navigation';
import { requireAuth } from '@/server/auth/session';
import { isGuestEmployeeUsername } from '@/lib/auth/guestEmployee';
import { createCheckin, createSimpleCheckin } from '@/lib/server/checkinsRepo';
import { validateSimpleCheckin } from '@/lib/checkins/validation';
import { validateRoomCheckin, normalizeReceipt } from '@/lib/checkins/validation/room';
import { parseRoomOptionValue } from '@/lib/checkins/rooms';
import { normalizePaymentMethod } from '@/lib/checkins/paymentMethods';
import { summarizeLineItems } from '@/lib/checkins/summarize';
import { calculatePaymentSplitTotal, validatePaymentSplits } from '@/lib/checkins/roomPaymentSplits';
import type { CheckIn, LineItem, SummarizedItem } from '@/types';
import type { FoodBeerDraft } from '@/lib/checkins/draft';
import { logError, logInfo } from '@/lib/server/log';
import { isValidRoomSubmissionKey } from '@/lib/checkins/roomSubmissionKey';

export type RoomCheckinActionResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Partial<Record<string, string>> };

export async function submitCheckinAction(formData: FormData): Promise<RoomCheckinActionResult> {
  const session = await requireAuth();
  const guestEmployee = session.role === 'employee' && isGuestEmployeeUsername(session.username);

  logInfo('checkin.room.submit.start', {
    role: session.role,
    username: session.username,
    userId: session.userId ?? null,
    room_id: formData.get('room_id'),
    receipt_number: formData.get('receipt_number'),
    has_payment_splits: Boolean(String(formData.get('payment_splits') ?? '').trim()),
  });

  const submissionKeyRaw = formData.get('submission_key');
  const submissionKey =
    typeof submissionKeyRaw === 'string' && isValidRoomSubmissionKey(submissionKeyRaw)
      ? submissionKeyRaw.trim()
      : null;
  if (!submissionKey) {
    logInfo('checkin.room.submit.missing_submission_key', { role: session.role });
    return {
      success: false,
      error: 'This confirmation is out of date. Go back to the room form and submit again.',
    };
  }

  const raw = {
    room_id: formData.get('room_id'),
    receipt_number: formData.get('receipt_number'),
    date: formData.get('date'),
    time: formData.get('time'),
    cost: formData.get('cost'),
    payment_method: formData.get('payment_method'),
    payment_splits: formData.get('payment_splits'),
    car_plate: formData.get('car_plate'),
    car_make: formData.get('car_make'),
    car_color: formData.get('car_color'),
    staff_name:
      session.role === 'employee'
        ? guestEmployee
          ? formData.get('staff_name')
          : (session.displayName ?? session.username)
        : formData.get('staff_name'),
    note: formData.get('note'),
  };

  const validation = validateRoomCheckin(raw as Record<string, unknown>);
  if (!validation.valid) {
    logInfo('checkin.room.submit.validation_failed', {
      role: session.role,
      errors: validation.errors,
    });
    return {
      success: false,
      error: Object.values(validation.errors).find(Boolean) ?? 'Please fix the errors below.',
      fieldErrors: validation.errors as Partial<Record<string, string>>,
    };
  }

  const receiptPadded = normalizeReceipt(String(raw.receipt_number ?? ''))!;
  const carPlate = String(raw.car_plate ?? '').trim().toUpperCase().slice(0, 10);
  const carMake = String(raw.car_make ?? '').trim().toUpperCase().slice(0, 30);
  const note = raw.note != null ? String(raw.note).trim().slice(0, 500) : undefined;

  const psRaw = raw.payment_splits;
  const hasSplitPayload =
    psRaw != null &&
    psRaw !== '' &&
    !(typeof psRaw === 'string' && String(psRaw).trim() === '');
  const splitResult = hasSplitPayload ? validatePaymentSplits(psRaw) : { valid: false as const };
  const resolvedSplits =
    splitResult.valid && splitResult.splits && splitResult.splits.length > 0
      ? splitResult.splits
      : null;
  const totalCollected = resolvedSplits
    ? calculatePaymentSplitTotal(resolvedSplits)
    : Number(raw.cost);

  const staffName = String(raw.staff_name).trim();
  const data: Omit<CheckIn, 'checkin_id'> = {
    room_id: parseRoomOptionValue(String(raw.room_id ?? '1')),
    receipt_number: receiptPadded,
    date: String(raw.date).trim(),
    time: String(raw.time).trim(),
    cost: totalCollected,
    payment_method: resolvedSplits
      ? resolvedSplits[0].method
      : normalizePaymentMethod(raw.payment_method != null ? String(raw.payment_method) : undefined),
    ...(resolvedSplits ? { payment_splits: resolvedSplits } : {}),
    staff_name: staffName,
    car_plate: carPlate,
    car_make: carMake,
    car_color: String(raw.car_color).trim(),
    note: note || undefined,
    ...(session.role === 'employee'
      ? {
          employee_id: session.userId?.trim() || (guestEmployee ? 'guest' : undefined),
          created_by_username: session.username?.trim(),
          employee_name_snapshot: staffName,
          created_by_role: 'employee',
        }
      : { created_by_role: 'admin' }),
  };

  try {
    const receiptNumber = await createCheckin(data, { submissionKey });
    logInfo('checkin.room.submit.success', {
      receiptNumber,
      role: session.role,
      userId: session.userId ?? null,
      room_id: data.room_id,
      created_by_role: data.created_by_role ?? null,
    });
  } catch (err) {
    logError('checkin.room.submit.failure', { message: String(err) });
    throw err;
  }

  redirect('/checkins/new');
}

export async function submitSimpleCheckinAction(
  checkInType: 'food' | 'beer',
  formData: FormData
): Promise<{ error?: string; lineItemErrors?: Record<number, { quantitySold?: string; amountCollected?: string; itemId?: string }> } | void> {
  const session = await requireAuth();
  const guestEmployee = session.role === 'employee' && isGuestEmployeeUsername(session.username);

  const date = (formData.get('date') as string)?.trim();
  const time = (formData.get('time') as string)?.trim();
  const staff_name =
    session.role === 'employee'
      ? guestEmployee
        ? String(formData.get('staff_name') ?? '').trim()
        : (session.displayName ?? session.username).trim()
      : ((formData.get('staff_name') as string) ?? '').trim();
  const notes = (formData.get('notes') as string)?.trim() || undefined;
  const payment_method = (formData.get('payment_method') as string)?.trim() ?? '';
  let lineItems: LineItem[] = [];
  let summarizedItems: SummarizedItem[] = [];
  try {
    const raw = formData.get('lineItems');
    if (typeof raw === 'string' && raw) {
      lineItems = JSON.parse(raw) as LineItem[];
    }
    const sumRaw = formData.get('summarizedItems');
    if (typeof sumRaw === 'string' && sumRaw) {
      summarizedItems = JSON.parse(sumRaw) as SummarizedItem[];
    }
  } catch {
    return { error: 'Invalid line items.' };
  }

  const validation = validateSimpleCheckin({
    date: date ?? '',
    time: time ?? '',
    staff_name: staff_name ?? '',
    checkInType,
    lineItems,
    notes,
    payment_method,
  });
  if (!validation.valid) {
    const firstError = Object.values(validation.errors).find(Boolean)
      ?? Object.values(validation.lineItemErrors ?? {}).flatMap((row) => Object.values(row)).find(Boolean);
    return {
      error: firstError ?? 'fix_errors_below',
      lineItemErrors: validation.lineItemErrors,
    };
  }

  await createSimpleCheckin(checkInType, {
    date: date!,
    time: time!,
    staff_name: staff_name!,
    lineItems,
    summarizedItems,
    notes,
    payment_method,
    ...(session.role === 'employee'
      ? {
          employee_id: session.userId?.trim() || (guestEmployee ? 'guest' : undefined),
          created_by_username: session.username?.trim(),
          employee_name_snapshot: staff_name!,
          created_by_role: 'employee' as const,
        }
      : { created_by_role: 'admin' as const }),
  });
  redirect('/checkins/new');
}

/** Confirm food/beer check-in from validation page draft. Returns result so client can clear draft and redirect. */
export async function confirmFoodBeerCheckinAction(
  draft: FoodBeerDraft
): Promise<{ error?: string }> {
  const session = await requireAuth();
  const guestEmployee = session.role === 'employee' && isGuestEmployeeUsername(session.username);

  const staff_name =
    session.role === 'employee'
      ? guestEmployee
        ? draft.staff_name.trim()
        : (session.displayName ?? session.username).trim()
      : draft.staff_name.trim();

  const validation = validateSimpleCheckin({
    date: draft.date,
    time: draft.time,
    staff_name,
    checkInType: draft.checkInType,
    lineItems: draft.lineItems,
    notes: draft.notes,
    payment_method: draft.payment_method,
  });
  if (!validation.valid) {
    const firstError = Object.values(validation.errors).find(Boolean)
      ?? Object.values(validation.lineItemErrors ?? {}).flatMap((row) => Object.values(row)).find(Boolean);
    return {
      error: firstError ?? 'fix_errors_below',
    };
  }

  const summarizedItems = summarizeLineItems(draft.lineItems);
  await createSimpleCheckin(draft.checkInType, {
    date: draft.date,
    time: draft.time,
    staff_name,
    lineItems: draft.lineItems,
    summarizedItems,
    notes: draft.notes,
    payment_method: draft.payment_method,
    ...(session.role === 'employee'
      ? {
          employee_id: session.userId?.trim() || (guestEmployee ? 'guest' : undefined),
          created_by_username: session.username?.trim(),
          employee_name_snapshot: staff_name,
          created_by_role: 'employee' as const,
        }
      : { created_by_role: 'admin' as const }),
  });
  return {};
}
