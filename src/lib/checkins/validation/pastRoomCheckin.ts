import { DateTime } from 'luxon';
import { normalizeReceipt } from '@/lib/checkins/validation/room';
import { isValidRoomId } from '@/lib/checkins/rooms';
import { validatePaymentSplits, calculatePaymentSplitTotal } from '@/lib/checkins/roomPaymentSplits';
import type { RoomPaymentSplit } from '@/types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export interface PastRoomCheckinValidationResult {
  valid: boolean;
  errors: Partial<Record<'room_id' | 'check_in_date' | 'check_in_time' | 'staff_name' | 'receipt_number' | 'payment_splits' | 'total', string>>;
  room_id?: number | string;
  check_in_date?: string;
  check_in_time?: string;
  staff_name?: string;
  receipt_number?: string;
  payment_splits?: RoomPaymentSplit[];
}

/**
 * Admin-only “Add Past Room Check-In” validation. Receipt is manual (no counter bump); duplicates allowed.
 */
export function validatePastRoomCheckinAdmin(
  raw: Record<string, unknown>,
  staffAllowlist: readonly string[]
): PastRoomCheckinValidationResult {
  const errors: PastRoomCheckinValidationResult['errors'] = {};

  const roomVal = raw.room_id;
  if (roomVal === undefined || roomVal === null || roomVal === '') {
    errors.room_id = 'Room number is required';
  } else if (!isValidRoomId(roomVal)) {
    errors.room_id = 'Please select a valid room';
  }

  const dateStr = raw.check_in_date != null ? String(raw.check_in_date).trim() : '';
  if (!dateStr) {
    errors.check_in_date = 'Check-in date is required';
  } else if (!DATE_RE.test(dateStr)) {
    errors.check_in_date = 'Invalid date format (YYYY-MM-DD)';
  } else {
    const d = DateTime.fromISO(dateStr, { zone: 'America/Puerto_Rico' });
    if (!d.isValid) errors.check_in_date = 'Invalid check-in date';
  }

  const timeStr = raw.check_in_time != null ? String(raw.check_in_time).trim() : '';
  if (!timeStr) {
    errors.check_in_time = 'Check-in time is required';
  } else if (!TIME_RE.test(timeStr)) {
    errors.check_in_time = 'Invalid time format (HH:mm, 24-hour)';
  }

  const staff = raw.staff_name != null ? String(raw.staff_name).trim() : '';
  if (!staff) {
    errors.staff_name = 'Staff attribution is required';
  } else if (!staffAllowlist.includes(staff)) {
    errors.staff_name = 'Staff must be selected from the allowed list';
  }

  const receiptRaw = raw.receipt_number != null ? String(raw.receipt_number).trim() : '';
  if (!receiptRaw) {
    errors.receipt_number = 'Receipt number is required';
  } else {
    const normalized = normalizeReceipt(receiptRaw);
    if (normalized === null) {
      errors.receipt_number = 'Receipt must be 5 digits (00000-99999)';
    }
  }

  const splitResult = validatePaymentSplits(raw.payment_splits);
  if (!splitResult.valid) {
    errors.payment_splits = 'Invalid payment breakdown';
  } else if (splitResult.splits) {
    const total = calculatePaymentSplitTotal(splitResult.splits);
    if (total <= 0) {
      errors.total = 'Total amount must be greater than 0';
    }
  }

  const valid = Object.keys(errors).length === 0;
  const normalizedReceipt = normalizeReceipt(String(raw.receipt_number ?? '').trim());
  return {
    valid,
    errors,
    ...(valid && normalizedReceipt && splitResult.splits && roomVal != null && dateStr && timeStr && staff
      ? {
          room_id: roomVal as number | string,
          check_in_date: dateStr,
          check_in_time: timeStr,
          staff_name: staff,
          receipt_number: normalizedReceipt,
          payment_splits: splitResult.splits,
        }
      : {}),
  };
}
