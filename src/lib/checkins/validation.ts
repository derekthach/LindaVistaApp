import type { CheckInType } from './types';
import type { LineItem, RoomPaymentSplit } from '@/types';
import { hasStoredPaymentMethodSingle } from '@/lib/checkins/paymentMethods';
import {
  FOOD_BEER_PAYMENT_SPLIT_OPTIONS,
  roundMoney,
  validatePaymentSplitsForExpectedTotal,
} from '@/lib/checkins/roomPaymentSplits';

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

export type FoodBeerLineItemAmountLimits = {
  maxAmountPerRow?: number;
  maxTotal?: number;
};

export interface SimpleCheckinFormValues {
  date: string;
  time: string;
  staff_name: string;
  checkInType: CheckInType;
  lineItems: LineItem[];
  notes?: string;
  /** Required for food and beer when payment_splits is absent (employee / legacy). */
  payment_method?: string;
  /** Admin multi-payment; when present, total must equal line-item total. */
  payment_splits?: unknown;
  /** Optional line-item amount caps (Admin Add Past Entry uses $5000). */
  lineItemAmountLimits?: FoodBeerLineItemAmountLimits;
}

export interface ValidationResult {
  valid: boolean;
  /** Error codes keyed by field (staff_name, date, time, lineItems, itemsTotal, notes, etc.) */
  errors: Record<string, string>;
  lineItemErrors?: Record<number, { quantitySold?: string; amountCollected?: string; itemId?: string }>;
  payment_splits?: RoomPaymentSplit[];
}

/** Food/beer item rows only (shared by simple check-in, past entry, admin updates). */
export function validateFoodBeerLineItemsRows(
  lineItems: LineItem[] | undefined,
  limits?: FoodBeerLineItemAmountLimits
): {
  errors: Partial<Pick<ValidationResult['errors'], 'lineItems' | 'itemsTotal'>>;
  lineItemErrors: Record<number, { quantitySold?: string; amountCollected?: string; itemId?: string }>;
} {
  const maxAmountPerRow = limits?.maxAmountPerRow ?? AMOUNT_MAX_PER_ROW;
  const maxTotal = limits?.maxTotal ?? TOTAL_AMOUNT_MAX;
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
        } else if (a > maxAmountPerRow) {
          row.amountCollected = VALIDATION_CODES.amountMax;
        } else {
          totalAmount += a;
        }
      }
      if (Object.keys(row).length > 0) {
        lineItemErrors[index] = row;
      }
    });
    if (totalAmount > maxTotal) {
      errors.itemsTotal = VALIDATION_CODES.totalMax;
    }
  }

  return { errors, lineItemErrors };
}

function lineItemsCollectedTotal(lineItems: LineItem[] | undefined): number {
  return roundMoney(
    (lineItems ?? []).reduce((sum, item) => {
      if (!item.itemId?.trim()) return sum;
      const a = Number(item.amountCollected);
      return sum + (Number.isFinite(a) && a > 0 ? a : 0);
    }, 0)
  );
}

/**
 * Validation for food/beer check-in form.
 * Returns error codes for bilingual display. Rules:
 * - Staff required; at least one valid item row (item selected, quantity 1-50 int, amount > 0 and <= 1000).
 * - Total amount across rows <= 2000. Notes optional, max 250 chars.
 * - Payment: either multi-splits matching line total, or a single stored payment_method.
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

  if (values.notes != null && values.notes.length > NOTES_MAX_LENGTH) {
    errors.notes = VALIDATION_CODES.notesMax;
  }

  const lineRes = validateFoodBeerLineItemsRows(values.lineItems, values.lineItemAmountLimits);
  if (lineRes.errors.lineItems) {
    errors.lineItems = lineRes.errors.lineItems;
  }
  if (lineRes.errors.itemsTotal) {
    errors.itemsTotal = lineRes.errors.itemsTotal;
  }
  Object.assign(lineItemErrors, lineRes.lineItemErrors);

  let payment_splits: RoomPaymentSplit[] | undefined;
  if (values.checkInType === 'food' || values.checkInType === 'beer') {
    const hasSplitsField =
      values.payment_splits != null &&
      values.payment_splits !== '' &&
      !(typeof values.payment_splits === 'string' && String(values.payment_splits).trim() === '') &&
      !(Array.isArray(values.payment_splits) && values.payment_splits.length === 0);

    if (hasSplitsField) {
      const expected = lineItemsCollectedTotal(values.lineItems);
      const splitResult = validatePaymentSplitsForExpectedTotal(
        values.payment_splits,
        expected,
        FOOD_BEER_PAYMENT_SPLIT_OPTIONS
      );
      if (!splitResult.valid || !splitResult.splits?.length) {
        errors.payment_splits = splitResult.error ?? 'err_payment_invalid_data';
      } else {
        payment_splits = splitResult.splits;
      }
    } else {
      const pm = values.payment_method?.trim() ?? '';
      if (!hasStoredPaymentMethodSingle(pm)) {
        errors.payment_method = VALIDATION_CODES.requiredPaymentMethod;
      }
    }
  }

  const valid = Object.keys(errors).length === 0 && Object.keys(lineItemErrors).length === 0;

  return {
    valid,
    errors,
    lineItemErrors: Object.keys(lineItemErrors).length > 0 ? lineItemErrors : undefined,
    ...(valid && payment_splits ? { payment_splits } : {}),
  };
}
