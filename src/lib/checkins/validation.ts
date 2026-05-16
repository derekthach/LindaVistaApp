import type { CheckInType } from './types';
import type { LineItem } from '@/types';
import { hasStoredPaymentMethodSingle } from '@/lib/checkins/paymentMethods';

/** Error codes returned by validation; map to bilingual messages in UI. */
export const VALIDATION_CODES = {
  requiredStaff: 'requiredStaff',
  requiredItem: 'requiredItem',
  atLeastOneItem: 'atLeastOneItem',
  quantityRequired: 'quantityRequired',
  quantityInteger: 'quantityInteger',
  quantityRange: 'quantityRange',
  amountRequired: 'amountRequired',
  amountPositive: 'amountPositive',
  amountMax: 'amountMax',
  totalMax: 'totalMax',
  notesMax: 'notesMax',
  requiredDate: 'requiredDate',
  requiredTime: 'requiredTime',
  invalidCheckInType: 'invalidCheckInType',
  requiredPaymentMethod: 'requiredPaymentMethod',
} as const;

export type ValidationCode = (typeof VALIDATION_CODES)[keyof typeof VALIDATION_CODES];

const QUANTITY_MIN = 1;
const QUANTITY_MAX = 50;
const AMOUNT_MAX_PER_ROW = 1000;
const TOTAL_AMOUNT_MAX = 2000;
const NOTES_MAX_LENGTH = 250;

export interface SimpleCheckinFormValues {
  date: string;
  time: string;
  staff_name: string;
  checkInType: CheckInType;
  lineItems: LineItem[];
  notes?: string;
  /** Required for food and beer normal check-ins. */
  payment_method?: string;
}

export interface ValidationResult {
  valid: boolean;
  /** Error codes keyed by field (staff_name, date, time, lineItems, itemsTotal, notes, etc.) */
  errors: Record<string, string>;
  lineItemErrors?: Record<number, { quantitySold?: string; amountCollected?: string; itemId?: string }>;
}

/** Food/beer item rows only (shared by simple check-in, past entry, admin updates). */
export function validateFoodBeerLineItemsRows(lineItems: LineItem[] | undefined): {
  errors: Partial<Pick<ValidationResult['errors'], 'lineItems' | 'itemsTotal'>>;
  lineItemErrors: Record<number, { quantitySold?: string; amountCollected?: string; itemId?: string }>;
} {
  const errors: Partial<Pick<ValidationResult['errors'], 'lineItems' | 'itemsTotal'>> = {};
  const lineItemErrors: Record<number, { quantitySold?: string; amountCollected?: string; itemId?: string }> = {};

  const items = lineItems ?? [];
  const validItems = items.filter((item) => item.itemId?.trim());
  if (validItems.length === 0) {
    errors.lineItems = VALIDATION_CODES.atLeastOneItem;
  } else {
    let totalAmount = 0;
    items.forEach((item, index) => {
      const row: { quantitySold?: string; amountCollected?: string; itemId?: string } = {};
      if (!item.itemId?.trim()) {
        row.itemId = VALIDATION_CODES.requiredItem;
      }
      const q = item.quantitySold;
      if (item.itemId?.trim()) {
        if (typeof q !== 'number' || Number.isNaN(q)) {
          row.quantitySold = VALIDATION_CODES.quantityRequired;
        } else if (Math.floor(q) !== q) {
          row.quantitySold = VALIDATION_CODES.quantityInteger;
        } else if (q < QUANTITY_MIN || q > QUANTITY_MAX) {
          row.quantitySold = VALIDATION_CODES.quantityRange;
        }
        const a = item.amountCollected;
        if (typeof a !== 'number' || Number.isNaN(a)) {
          row.amountCollected = VALIDATION_CODES.amountRequired;
        } else if (a <= 0) {
          row.amountCollected = VALIDATION_CODES.amountPositive;
        } else if (a > AMOUNT_MAX_PER_ROW) {
          row.amountCollected = VALIDATION_CODES.amountMax;
        } else {
          totalAmount += a;
        }
      }
      if (Object.keys(row).length > 0) {
        lineItemErrors[index] = row;
      }
    });
    if (totalAmount > TOTAL_AMOUNT_MAX) {
      errors.itemsTotal = VALIDATION_CODES.totalMax;
    }
  }

  return { errors, lineItemErrors };
}

/**
 * Validation for food/beer check-in form.
 * Returns error codes for bilingual display. Rules:
 * - Staff required; at least one valid item row (item selected, quantity 1-50 int, amount > 0 and <= 1000).
 * - Total amount across rows <= 2000. Notes optional, max 250 chars.
 */
export function validateSimpleCheckin(values: SimpleCheckinFormValues): ValidationResult {
  const errors: Record<string, string> = {};
  const lineItemErrors: Record<number, { quantitySold?: string; amountCollected?: string; itemId?: string }> =
    {};

  if (!values.date?.trim()) {
    errors.date = VALIDATION_CODES.requiredDate;
  }
  if (!values.time?.trim()) {
    errors.time = VALIDATION_CODES.requiredTime;
  }
  if (!values.staff_name?.trim()) {
    errors.staff_name = VALIDATION_CODES.requiredStaff;
  }
  if (!values.checkInType || !['room', 'food', 'beer'].includes(values.checkInType)) {
    errors.checkInType = VALIDATION_CODES.invalidCheckInType;
  }

  if (values.checkInType === 'food' || values.checkInType === 'beer') {
    const pm = values.payment_method?.trim() ?? '';
    if (!hasStoredPaymentMethodSingle(pm)) {
      errors.payment_method = VALIDATION_CODES.requiredPaymentMethod;
    }
  }

  if (values.notes != null && values.notes.length > NOTES_MAX_LENGTH) {
    errors.notes = VALIDATION_CODES.notesMax;
  }

  const lineRes = validateFoodBeerLineItemsRows(values.lineItems);
  if (lineRes.errors.lineItems) {
    errors.lineItems = lineRes.errors.lineItems;
  }
  if (lineRes.errors.itemsTotal) {
    errors.itemsTotal = lineRes.errors.itemsTotal;
  }
  Object.assign(lineItemErrors, lineRes.lineItemErrors);

  const valid = Object.keys(errors).length === 0 && Object.keys(lineItemErrors).length === 0;

  return {
    valid,
    errors,
    lineItemErrors: Object.keys(lineItemErrors).length > 0 ? lineItemErrors : undefined,
  };
}
