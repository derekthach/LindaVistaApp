'use server';

import { redirect } from 'next/navigation';
import { requireAuth } from '@/server/auth/session';
import { createCheckin, createSimpleCheckin } from '@/lib/server/checkinsRepo';
import { validateSimpleCheckin } from '@/lib/checkins/validation';
import { validateRoomCheckin, normalizeReceipt } from '@/lib/checkins/validation/room';
import { summarizeLineItems } from '@/lib/checkins/summarize';
import type { CheckIn, LineItem, SummarizedItem } from '@/types';
import type { FoodBeerDraft } from '@/lib/checkins/draft';

export type RoomCheckinActionResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Partial<Record<string, string>> };

export async function submitCheckinAction(formData: FormData): Promise<RoomCheckinActionResult> {
  await requireAuth();

  const raw = {
    room_id: formData.get('room_id'),
    receipt_number: formData.get('receipt_number'),
    date: formData.get('date'),
    time: formData.get('time'),
    cost: formData.get('cost'),
    payment_method: formData.get('payment_method'),
    car_plate: formData.get('car_plate'),
    car_make: formData.get('car_make'),
    car_color: formData.get('car_color'),
    staff_name: formData.get('staff_name'),
    note: formData.get('note'),
  };

  const validation = validateRoomCheckin(raw as Record<string, unknown>);
  if (!validation.valid) {
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

  const data: Omit<CheckIn, 'checkin_id'> = {
    room_id: Number(raw.room_id),
    receipt_number: receiptPadded,
    date: String(raw.date).trim(),
    time: String(raw.time).trim(),
    cost: Number(raw.cost),
    payment_method: (raw.payment_method as 'cash' | 'ath_mobil') ?? 'cash',
    staff_name: String(raw.staff_name).trim(),
    car_plate: carPlate,
    car_make: carMake,
    car_color: String(raw.car_color).trim(),
    note: note || undefined,
  };

  await createCheckin(data);
  redirect('/checkins/new');
}

export async function submitSimpleCheckinAction(
  checkInType: 'food' | 'beer',
  formData: FormData
): Promise<{ error?: string; lineItemErrors?: Record<number, { quantitySold?: string; amountCollected?: string; itemId?: string }> } | void> {
  await requireAuth();

  const date = (formData.get('date') as string)?.trim();
  const time = (formData.get('time') as string)?.trim();
  const staff_name = (formData.get('staff_name') as string)?.trim();
  const notes = (formData.get('notes') as string)?.trim() || undefined;
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
  });
  redirect('/checkins/new');
}

/** Confirm food/beer check-in from validation page draft. Returns result so client can clear draft and redirect. */
export async function confirmFoodBeerCheckinAction(
  draft: FoodBeerDraft
): Promise<{ error?: string }> {
  await requireAuth();

  const validation = validateSimpleCheckin({
    date: draft.date,
    time: draft.time,
    staff_name: draft.staff_name,
    checkInType: draft.checkInType,
    lineItems: draft.lineItems,
    notes: draft.notes,
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
    staff_name: draft.staff_name,
    lineItems: draft.lineItems,
    summarizedItems,
    notes: draft.notes,
  });
  return {};
}
