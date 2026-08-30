/**
 * View Check-ins Advanced Filters (Phase 2).
 * Single-value filters combined with AND; blank / "any" ignored.
 * Date range is shared with the main page controls (not counted in the badge).
 */

import type { CheckIn, CheckInType } from '@/types';
import { getBucketIndex, timeToMinutes } from '@/lib/checkins/sectioning';
import { formatReceiptNumber } from '@/lib/checkins/receipt';
import {
  getCheckInPaymentMethodValues,
  isValidPaymentMethod,
  type PaymentMethodValue,
} from '@/lib/checkins/paymentMethods';

/** View Check-ins closed buckets: 0 overnight, 1 day, 2 evening. */
export type ViewCheckinsShiftBucket = 0 | 1 | 2;

export type AdvancedCheckinsFilters = {
  receipt: string;
  /** Empty string = Any shift. Otherwise bucket index as "0" | "1" | "2". */
  shift: '' | '0' | '1' | '2';
  type: '' | CheckInType;
  room: string;
  staff: string;
  payment: '' | PaymentMethodValue;
};

export const EMPTY_ADVANCED_FILTERS: AdvancedCheckinsFilters = {
  receipt: '',
  shift: '',
  type: '',
  room: '',
  staff: '',
  payment: '',
};

export type AdvancedFiltersSearchParams = {
  receipt?: string;
  shift?: string;
  type?: string;
  room?: string;
  staff?: string;
  payment?: string;
};

export function parseAdvancedFiltersFromSearchParams(
  params: AdvancedFiltersSearchParams
): AdvancedCheckinsFilters {
  const receipt = typeof params.receipt === 'string' ? params.receipt.trim() : '';

  const shiftRaw = typeof params.shift === 'string' ? params.shift.trim() : '';
  const shift: AdvancedCheckinsFilters['shift'] =
    shiftRaw === '0' || shiftRaw === '1' || shiftRaw === '2' ? shiftRaw : '';

  const typeRaw = typeof params.type === 'string' ? params.type.trim() : '';
  const type: AdvancedCheckinsFilters['type'] =
    typeRaw === 'room' || typeRaw === 'food' || typeRaw === 'beer' ? typeRaw : '';

  const room = typeof params.room === 'string' ? params.room.trim() : '';
  const staff = typeof params.staff === 'string' ? params.staff.trim() : '';

  const paymentRaw = typeof params.payment === 'string' ? params.payment.trim().toLowerCase() : '';
  const payment: AdvancedCheckinsFilters['payment'] = isValidPaymentMethod(paymentRaw)
    ? paymentRaw
    : '';

  return { receipt, shift, type, room, staff, payment };
}

/** Non-date advanced filters currently set (for badge / chips). */
export function countActiveAdvancedFilters(filters: AdvancedCheckinsFilters): number {
  let n = 0;
  if (filters.receipt) n += 1;
  if (filters.shift) n += 1;
  if (filters.type) n += 1;
  if (filters.room) n += 1;
  if (filters.staff) n += 1;
  if (filters.payment) n += 1;
  return n;
}

export function hasActiveAdvancedFilters(filters: AdvancedCheckinsFilters): boolean {
  return countActiveAdvancedFilters(filters) > 0;
}

export function appendAdvancedFiltersToSearchParams(
  params: URLSearchParams,
  filters: AdvancedCheckinsFilters
): void {
  if (filters.receipt) params.set('receipt', filters.receipt);
  if (filters.shift) params.set('shift', filters.shift);
  if (filters.type) params.set('type', filters.type);
  if (filters.room) params.set('room', filters.room);
  if (filters.staff) params.set('staff', filters.staff);
  if (filters.payment) params.set('payment', filters.payment);
}

function receiptMatches(checkin: CheckIn, receiptFilter: string): boolean {
  const want = formatReceiptNumber(receiptFilter);
  if (!want) return false;
  const have = formatReceiptNumber(checkin.receipt_number ?? '');
  return have !== '' && have === want;
}

function shiftMatches(checkin: CheckIn, shift: '0' | '1' | '2'): boolean {
  const idx = getBucketIndex(timeToMinutes(checkin.time));
  return String(idx) === shift;
}

/**
 * Apply Phase-2 advanced filters to an already date-scoped check-in list.
 * Pure — no Firestore. Reuses View Check-ins shift buckets and payment helpers.
 */
export function applyAdvancedFilters(
  checkins: CheckIn[],
  filters: AdvancedCheckinsFilters
): CheckIn[] {
  if (!hasActiveAdvancedFilters(filters)) return checkins;

  return checkins.filter((c) => {
    if (filters.receipt && !receiptMatches(c, filters.receipt)) return false;
    if (filters.shift && !shiftMatches(c, filters.shift)) return false;
    if (filters.type) {
      const t = c.checkInType ?? 'room';
      if (t !== filters.type) return false;
    }
    if (filters.room) {
      if (String(c.room_id ?? '') !== filters.room) return false;
    }
    if (filters.staff) {
      if ((c.staff_name ?? '').trim() !== filters.staff) return false;
    }
    if (filters.payment) {
      const methods = getCheckInPaymentMethodValues(c);
      if (!methods.includes(filters.payment)) return false;
    }
    return true;
  });
}

export type AdvancedFilterChipKey = keyof Omit<AdvancedCheckinsFilters, never>;

export type AdvancedFilterChip = {
  key: keyof AdvancedCheckinsFilters;
  /** Stable id for React keys */
  id: string;
  label: string;
};

/** Chip descriptors for non-empty advanced filters (labels filled by UI with i18n). */
export function listActiveAdvancedFilterKeys(
  filters: AdvancedCheckinsFilters
): (keyof AdvancedCheckinsFilters)[] {
  const keys: (keyof AdvancedCheckinsFilters)[] = [];
  if (filters.receipt) keys.push('receipt');
  if (filters.shift) keys.push('shift');
  if (filters.type) keys.push('type');
  if (filters.room) keys.push('room');
  if (filters.staff) keys.push('staff');
  if (filters.payment) keys.push('payment');
  return keys;
}

export function clearOneAdvancedFilter(
  filters: AdvancedCheckinsFilters,
  key: keyof AdvancedCheckinsFilters
): AdvancedCheckinsFilters {
  return { ...filters, [key]: '' };
}
