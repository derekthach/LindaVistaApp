import type { CheckInType } from './types';
import type { LineItem } from '@/types';

export interface SimpleCheckinFormValues {
  date: string;
  time: string;
  staff_name: string;
  checkInType: CheckInType;
  lineItems: LineItem[];
  notes?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof SimpleCheckinFormValues, string>>;
  lineItemErrors?: Record<number, { quantitySold?: string; amountCollected?: string; itemId?: string }>;
}

/**
 * Lightweight validation for food/beer check-in form.
 * Requires: date, time, staff_name, checkInType, at least one line item with itemId, quantitySold >= 1, amountCollected >= 0.
 */
export function validateSimpleCheckin(values: SimpleCheckinFormValues): ValidationResult {
  const errors: ValidationResult['errors'] = {};
  const lineItemErrors: ValidationResult['lineItemErrors'] = {};

  if (!values.date?.trim()) {
    errors.date = 'Date is required';
  }
  if (!values.time?.trim()) {
    errors.time = 'Time is required';
  }
  if (!values.staff_name?.trim()) {
    errors.staff_name = 'Staff name is required';
  }
  if (!values.checkInType || !['room', 'food', 'beer'].includes(values.checkInType)) {
    errors.checkInType = 'Invalid check-in type';
  }

  if (!values.lineItems?.length) {
    errors.lineItems = 'At least one item is required';
  } else {
    values.lineItems.forEach((item, index) => {
      const row: NonNullable<ValidationResult['lineItemErrors']>[number] = {};
      if (!item.itemId?.trim()) {
        row.itemId = 'Item is required';
      }
      const q = item.quantitySold;
      if (typeof q !== 'number' || Number.isNaN(q) || q < 1 || Math.floor(q) !== q) {
        row.quantitySold = 'Quantity must be a whole number ≥ 1';
      }
      const a = item.amountCollected;
      if (typeof a !== 'number' || Number.isNaN(a) || a < 0) {
        row.amountCollected = 'Amount must be ≥ 0';
      }
      if (Object.keys(row).length > 0) {
        lineItemErrors[index] = row;
      }
    });
  }

  return {
    valid: Object.keys(errors).length === 0 && Object.keys(lineItemErrors).length === 0,
    errors,
    lineItemErrors: Object.keys(lineItemErrors).length > 0 ? lineItemErrors : undefined,
  };
}
