import { normalizeReceipt } from './room';
import { isValidRoomId } from '../rooms';
import { validatePaymentSplits } from '../roomPaymentSplits';
import type { RoomPaymentSplit } from '@/types';

const ALLOWED_STAFF = ['Keith Thach', 'Duyen Thach', 'Derek Thach'] as const;

export interface UpdateCheckinPayload {
  receipt_number: string;
  staff_name: string;
  room_id?: number | string;
  payment_splits: RoomPaymentSplit[];
}

export interface UpdateCheckinValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof UpdateCheckinPayload, string>>;
  /** Populated when valid and isRoomType. */
  payment_splits?: RoomPaymentSplit[];
}

/**
 * Server-side validation for admin check-in update.
 * Does not validate checkInAt (not allowed to change).
 */
export function validateUpdateCheckin(
  raw: Record<string, unknown>,
  isRoomType: boolean
): UpdateCheckinValidationResult {
  const errors: UpdateCheckinValidationResult['errors'] = {};

  const receiptRaw = raw.receipt_number != null ? String(raw.receipt_number).trim() : '';
  if (!receiptRaw) {
    errors.receipt_number = 'Receipt number is required';
  } else {
    const normalized = normalizeReceipt(receiptRaw);
    if (normalized === null) {
      errors.receipt_number = 'Receipt must be 5 digits (00000-99999)';
    }
  }

  const staff = raw.staff_name != null ? String(raw.staff_name).trim() : '';
  if (!staff) {
    errors.staff_name = 'Staff is required';
  } else if (!ALLOWED_STAFF.includes(staff as (typeof ALLOWED_STAFF)[number])) {
    errors.staff_name = 'Staff must be one of: ' + ALLOWED_STAFF.join(', ');
  }

  let parsedSplits: RoomPaymentSplit[] | undefined;
  if (isRoomType) {
    const splitResult = validatePaymentSplits(raw.payment_splits);
    if (!splitResult.valid) {
      errors.payment_splits = splitResult.error ?? 'Invalid payment breakdown';
    } else {
      parsedSplits = splitResult.splits;
    }
    const roomVal = raw.room_id;
    if (roomVal === undefined || roomVal === null) {
      errors.room_id = 'Room number is required';
    } else if (!isValidRoomId(roomVal)) {
      errors.room_id = 'Please select a valid room';
    }
  }

  const valid = Object.keys(errors).length === 0;
  return {
    valid,
    errors,
    ...(valid && isRoomType && parsedSplits ? { payment_splits: parsedSplits } : {}),
  };
}

const AMOUNT_COLLECTED_MAX = 1000;
const QUANTITY_MIN = 1;
const QUANTITY_MAX = 999;

export interface UpdateFoodBeerPayload {
  receipt_number: string;
  staff_name: string;
  itemId: string;
  itemLabel?: string;
  quantity: number;
  amountCollected: number;
}

export interface UpdateFoodBeerValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof UpdateFoodBeerPayload, string>>;
}

/** Employee self-edit: item / quantity / amount only (no receipt/staff validation). */
export function validateEmployeeOperationalFoodBeer(
  raw: Record<string, unknown>
): UpdateFoodBeerValidationResult {
  const errors: UpdateFoodBeerValidationResult['errors'] = {};

  const itemId = raw.itemId != null ? String(raw.itemId).trim() : '';
  if (!itemId) {
    errors.itemId = 'Item is required';
  }

  const qtyVal = raw.quantity;
  if (qtyVal === undefined || qtyVal === null || qtyVal === '') {
    errors.quantity = 'Quantity is required';
  } else {
    const qty = Number(qtyVal);
    if (Number.isNaN(qty) || !Number.isInteger(qty) || qty < QUANTITY_MIN || qty > QUANTITY_MAX) {
      errors.quantity = `Quantity must be a whole number from ${QUANTITY_MIN} to ${QUANTITY_MAX}`;
    }
  }

  const amountVal = raw.amountCollected;
  if (amountVal === undefined || amountVal === null || amountVal === '') {
    errors.amountCollected = 'Amount collected is required';
  } else {
    const amount = Number(amountVal);
    if (Number.isNaN(amount)) {
      errors.amountCollected = 'Amount must be a number';
    } else if (amount < 0) {
      errors.amountCollected = 'Amount cannot be negative';
    } else if (amount > AMOUNT_COLLECTED_MAX) {
      errors.amountCollected = `Amount cannot exceed $${AMOUNT_COLLECTED_MAX}`;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/** Payment breakdown only (employee room edit). */
export function validateEmployeeOperationalRoom(
  raw: Record<string, unknown>
): UpdateCheckinValidationResult {
  const errors: UpdateCheckinValidationResult['errors'] = {};
  const splitResult = validatePaymentSplits(raw.payment_splits);
  if (!splitResult.valid || !splitResult.splits?.length) {
    errors.payment_splits = splitResult.error ?? 'Invalid payment breakdown';
    return { valid: false, errors };
  }
  return {
    valid: true,
    errors: {},
    payment_splits: splitResult.splits,
  };
}

export function validateUpdateFoodBeerCheckin(
  raw: Record<string, unknown>
): UpdateFoodBeerValidationResult {
  const errors: UpdateFoodBeerValidationResult['errors'] = {};

  const receiptRaw = raw.receipt_number != null ? String(raw.receipt_number).trim() : '';
  if (!receiptRaw) {
    errors.receipt_number = 'Receipt number is required';
  } else {
    const normalized = normalizeReceipt(receiptRaw);
    if (normalized === null) {
      errors.receipt_number = 'Receipt must be 5 digits (00000-99999)';
    }
  }

  const staff = raw.staff_name != null ? String(raw.staff_name).trim() : '';
  if (!staff) {
    errors.staff_name = 'Staff is required';
  } else if (!ALLOWED_STAFF.includes(staff as (typeof ALLOWED_STAFF)[number])) {
    errors.staff_name = 'Staff must be one of: ' + ALLOWED_STAFF.join(', ');
  }

  const itemId = raw.itemId != null ? String(raw.itemId).trim() : '';
  if (!itemId) {
    errors.itemId = 'Item is required';
  }

  const qtyVal = raw.quantity;
  if (qtyVal === undefined || qtyVal === null || qtyVal === '') {
    errors.quantity = 'Quantity is required';
  } else {
    const qty = Number(qtyVal);
    if (Number.isNaN(qty) || !Number.isInteger(qty) || qty < QUANTITY_MIN || qty > QUANTITY_MAX) {
      errors.quantity = `Quantity must be a whole number from ${QUANTITY_MIN} to ${QUANTITY_MAX}`;
    }
  }

  const amountVal = raw.amountCollected;
  if (amountVal === undefined || amountVal === null || amountVal === '') {
    errors.amountCollected = 'Amount collected is required';
  } else {
    const amount = Number(amountVal);
    if (Number.isNaN(amount)) {
      errors.amountCollected = 'Amount must be a number';
    } else if (amount < 0) {
      errors.amountCollected = 'Amount cannot be negative';
    } else if (amount > AMOUNT_COLLECTED_MAX) {
      errors.amountCollected = `Amount cannot exceed $${AMOUNT_COLLECTED_MAX}`;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export { ALLOWED_STAFF };
