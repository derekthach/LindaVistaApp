import { normalizeReceipt } from './room';
import {
  isValidRoomId,
  isValidEmployeeRoomCorrection,
  parseEmployeeRoomPatchValue,
  parseAdminLateRoomValue,
} from '../rooms';
import { validatePaymentSplits } from '../roomPaymentSplits';
import type { RoomPaymentSplit } from '@/types';
import { hasStoredPaymentMethodSingle } from '@/lib/checkins/paymentMethods';
import { VALIDATION_CODES } from '@/lib/checkins/validation';
import { validateFoodBeerLineItemsRows } from '@/lib/checkins/validation';
import type { LineItem } from '@/types';
import type { ItemOption } from '@/lib/checkins/items';
import { parseLineItemsFromUnknown, normalizeSubmittedFoodBeerLineItems } from '@/lib/checkins/lineItemsPayload';

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
  /** Populated when employee room PATCH is valid. */
  room_id?: number | string;
}

export interface ValidateUpdateCheckinOptions {
  /** When provided (e.g. merged Firestore + legacy staff), staff_name must be in this list. */
  staffAllowlist?: readonly string[];
  /** Allows the admin late-entry placeholder room. */
  allowLateEntryPlaceholderRoom?: boolean;
}

/**
 * Server-side validation for admin check-in update.
 * checkInAt changes are validated separately in the PATCH handler for past-entry docs only.
 */
export function validateUpdateCheckin(
  raw: Record<string, unknown>,
  isRoomType: boolean,
  options?: ValidateUpdateCheckinOptions
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
  const allowlist = options?.staffAllowlist;
  if (!staff) {
    errors.staff_name = 'Staff is required';
  } else if (allowlist && allowlist.length > 0) {
    if (!allowlist.includes(staff)) {
      errors.staff_name = 'Staff must be selected from the allowed list';
    }
  } else if (!ALLOWED_STAFF.includes(staff as (typeof ALLOWED_STAFF)[number])) {
    errors.staff_name = 'Staff must be one of: ' + ALLOWED_STAFF.join(', ');
  }

  let parsedSplits: RoomPaymentSplit[] | undefined;
  let parsedRoomId: number | string | undefined;
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
    } else if (options?.allowLateEntryPlaceholderRoom) {
      parsedRoomId = parseAdminLateRoomValue(roomVal) ?? undefined;
      if (parsedRoomId === undefined) {
        errors.room_id = 'Please select a valid room';
      }
    } else if (!isValidRoomId(roomVal)) {
      errors.room_id = 'Please select a valid room';
    } else {
      parsedRoomId =
        typeof roomVal === 'number'
          ? roomVal
          : parseEmployeeRoomPatchValue(roomVal) ?? String(roomVal).trim();
    }
  }

  const valid = Object.keys(errors).length === 0;
  return {
    valid,
    errors,
    ...(valid && isRoomType && parsedSplits ? { payment_splits: parsedSplits } : {}),
    ...(valid && isRoomType && parsedRoomId !== undefined ? { room_id: parsedRoomId } : {}),
  };
}

const AMOUNT_COLLECTED_MAX = 1000;
const QUANTITY_MIN = 1;
const QUANTITY_MAX = 50;

export interface UpdateFoodBeerPayload {
  staff_name: string;
  itemId: string;
  itemLabel?: string;
  quantity: number;
  amountCollected: number;
  payment_method: string;
}

export interface UpdateFoodBeerValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof UpdateFoodBeerPayload | 'lineItems' | 'itemsTotal', string>>;
  normalizedLineItems?: LineItem[];
}

export interface ValidateUpdateFoodBeerCheckinOptions extends ValidateUpdateCheckinOptions {
  /** When set, each line itemId must exist in this catalog (admin updates). */
  catalog?: readonly ItemOption[];
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

/** Payment breakdown + room (employee room edit). */
export function validateEmployeeOperationalRoom(
  raw: Record<string, unknown>
): UpdateCheckinValidationResult {
  const errors: UpdateCheckinValidationResult['errors'] = {};
  const splitResult = validatePaymentSplits(raw.payment_splits);
  if (!splitResult.valid || !splitResult.splits?.length) {
    errors.payment_splits = splitResult.error ?? 'Invalid payment breakdown';
    return { valid: false, errors };
  }
  const roomVal = raw.room_id;
  if (roomVal === undefined || roomVal === null || roomVal === '') {
    errors.room_id = 'error_room_required';
    return { valid: false, errors };
  }
  if (!isValidEmployeeRoomCorrection(roomVal)) {
    errors.room_id = 'error_room_invalid';
    return { valid: false, errors };
  }
  const parsedRoom = parseEmployeeRoomPatchValue(roomVal);
  if (parsedRoom === null) {
    errors.room_id = 'error_room_invalid';
    return { valid: false, errors };
  }
  return {
    valid: true,
    errors: {},
    payment_splits: splitResult.splits,
    room_id: parsedRoom,
  };
}

export function validateUpdateFoodBeerCheckin(
  raw: Record<string, unknown>,
  options?: ValidateUpdateFoodBeerCheckinOptions
): UpdateFoodBeerValidationResult {
  const errors: UpdateFoodBeerValidationResult['errors'] = {};

  const staff = raw.staff_name != null ? String(raw.staff_name).trim() : '';
  const allowlist = options?.staffAllowlist;
  if (!staff) {
    errors.staff_name = 'Staff is required';
  } else if (allowlist && allowlist.length > 0) {
    if (!allowlist.includes(staff)) {
      errors.staff_name = 'Staff must be selected from the allowed list';
    }
  } else if (!ALLOWED_STAFF.includes(staff as (typeof ALLOWED_STAFF)[number])) {
    errors.staff_name = 'Staff must be one of: ' + ALLOWED_STAFF.join(', ');
  }

  const pm = raw.payment_method != null ? String(raw.payment_method).trim() : '';
  if (!hasStoredPaymentMethodSingle(pm)) {
    errors.payment_method = VALIDATION_CODES.requiredPaymentMethod;
  }

  const parsedLines = parseLineItemsFromUnknown(raw.lineItems);
  const useMulti =
    parsedLines !== null &&
    parsedLines.some((r) => String(r.itemId ?? '').trim().length > 0);

  if (useMulti && parsedLines) {
    const rowVal = validateFoodBeerLineItemsRows(parsedLines);
    if (rowVal.errors.lineItems) {
      errors.lineItems = 'At least one item row with item, quantity, and amount is required.';
    }
    if (rowVal.errors.itemsTotal) {
      errors.itemsTotal = 'Total amount exceeds the allowed maximum for one check-in.';
    }
    if (Object.keys(rowVal.lineItemErrors).length > 0 && !errors.lineItems) {
      errors.lineItems = 'Fix quantity and amount on each item row.';
    }

    const catalog = options?.catalog;
    const normalizedLineItems = normalizeSubmittedFoodBeerLineItems(parsedLines);

    if (catalog && catalog.length > 0) {
      for (const row of normalizedLineItems) {
        if (!catalog.some((o) => o.id === row.itemId)) {
          errors.lineItems = 'Invalid item';
          break;
        }
      }
    }

    const valid = Object.keys(errors).length === 0 && normalizedLineItems.length > 0;
    if (!valid) {
      return { valid: false, errors };
    }
    return { valid: true, errors: {}, normalizedLineItems };
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

  const valid = Object.keys(errors).length === 0;
  if (!valid) {
    return { valid: false, errors };
  }

  const normalizedLineItems: LineItem[] = [
    {
      itemId,
      itemLabel:
        raw.itemLabel != null && String(raw.itemLabel).trim()
          ? String(raw.itemLabel).trim()
          : itemId,
      quantitySold: Math.floor(Number(raw.quantity)),
      amountCollected: Number(raw.amountCollected),
    },
  ];

  const catalog = options?.catalog;
  if (catalog && catalog.length > 0) {
    for (const row of normalizedLineItems) {
      if (!catalog.some((o) => o.id === row.itemId)) {
        return { valid: false, errors: { ...errors, itemId: 'Invalid item' } };
      }
    }
  }

  return { valid: true, errors: {}, normalizedLineItems };
}

export { ALLOWED_STAFF };
