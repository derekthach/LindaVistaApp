import { normalizeReceipt } from './room';
import { isValidRoomId } from '../rooms';

const ALLOWED_STAFF = ['Keith Thach', 'Duyen Thach', 'Derek Thach'] as const;
const COST_MAX = 1000;

export interface UpdateCheckinPayload {
  receipt_number: string;
  staff_name: string;
  cost: number;
  room_id?: number | string;
}

export interface UpdateCheckinValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof UpdateCheckinPayload, string>>;
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

  const costVal = raw.cost;
  if (costVal === undefined || costVal === null || costVal === '') {
    errors.cost = 'Cost is required';
  } else {
    const cost = Number(costVal);
    if (Number.isNaN(cost)) {
      errors.cost = 'Cost must be a number';
    } else if (cost < 0) {
      errors.cost = 'Cost cannot be negative';
    } else if (cost > COST_MAX) {
      errors.cost = `Cost cannot exceed $${COST_MAX}`;
    }
  }

  if (isRoomType) {
    const roomVal = raw.room_id;
    if (roomVal === undefined || roomVal === null) {
      errors.room_id = 'Room number is required';
    } else if (!isValidRoomId(roomVal)) {
      errors.room_id = 'Please select a valid room';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
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
