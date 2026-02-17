'use server';

import { redirect } from 'next/navigation';
import { requireAuth } from '@/server/auth/session';
import { createCheckin, createSimpleCheckin } from '@/lib/server/checkinsRepo';
import { validateSimpleCheckin } from '@/lib/checkins/validation';
import { summarizeLineItems } from '@/lib/checkins/summarize';
import type { CheckIn, LineItem, SummarizedItem } from '@/types';
import type { FoodBeerDraft } from '@/lib/checkins/draft';

export async function submitCheckinAction(formData: FormData) {
  await requireAuth();

  const data: Omit<CheckIn, 'checkin_id'> = {
    room_id: parseInt(formData.get('room_id') as string),
    receipt_number: formData.get('receipt_number') as string,
    date: formData.get('date') as string,
    time: formData.get('time') as string,
    cost: parseFloat(formData.get('cost') as string),
    payment_method: formData.get('payment_method') as 'cash' | 'ath_mobil',
    staff_name: formData.get('staff_name') as string,
    car_plate: formData.get('car_plate') as string,
    car_make: formData.get('car_make') as string,
    car_color: formData.get('car_color') as string,
    note: (formData.get('note') as string) || undefined,
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
    return {
      error: Object.values(validation.errors).find(Boolean) ?? 'Please fix the errors below.',
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
    return {
      error: Object.values(validation.errors).find(Boolean) ?? 'Please fix the errors below.',
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
