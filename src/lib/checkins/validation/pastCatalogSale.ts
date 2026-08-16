import { DateTime } from 'luxon';
import { isValidPaymentMethod, normalizePaymentMethod } from '@/lib/checkins/paymentMethods';
import type { ItemOption } from '@/lib/checkins/items';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const QUANTITY_MIN = 1;
const QUANTITY_MAX = 50;
const AMOUNT_MAX = 5000;
const NOTES_MAX = 250;

export interface PastCatalogSaleValidationResult {
  valid: boolean;
  errors: Partial<
    Record<
      | 'date'
      | 'time'
      | 'staff_name'
      | 'item_id'
      | 'quantity'
      | 'amount'
      | 'payment_method'
      | 'notes',
      string
    >
  >;
  date?: string;
  time?: string;
  staff_name?: string;
  item_id?: string;
  item_label?: string;
  quantity_sold?: number;
  amount_collected?: number;
  payment_method?: string;
  notes?: string;
}

/**
 * Admin-only historical food or beer line item (single row). Catalog determines valid item IDs.
 */
export function validatePastCatalogSaleAdmin(
  raw: Record<string, unknown>,
  staffAllowlist: readonly string[],
  catalog: readonly ItemOption[]
): PastCatalogSaleValidationResult {
  const errors: PastCatalogSaleValidationResult['errors'] = {};

  const dateStr = raw.date != null ? String(raw.date).trim() : '';
  if (!dateStr) {
    errors.date = 'Date is required';
  } else if (!DATE_RE.test(dateStr)) {
    errors.date = 'Invalid date format (YYYY-MM-DD)';
  } else {
    const d = DateTime.fromISO(dateStr, { zone: 'America/Puerto_Rico' });
    if (!d.isValid) errors.date = 'Invalid date';
  }

  const timeStr = raw.time != null ? String(raw.time).trim() : '';
  const timeHm = timeStr.slice(0, 5);
  if (!timeStr) {
    errors.time = 'Time is required';
  } else if (!TIME_RE.test(timeHm)) {
    errors.time = 'Invalid time format (HH:mm, 24-hour)';
  }

  const staff = raw.staff_name != null ? String(raw.staff_name).trim() : '';
  if (!staff) {
    errors.staff_name = 'Staff attribution is required';
  } else if (!staffAllowlist.includes(staff)) {
    errors.staff_name = 'Staff must be selected from the allowed list';
  }

  const itemId = raw.item_id != null ? String(raw.item_id).trim() : '';
  if (!itemId) {
    errors.item_id = 'Item is required';
  } else if (!catalog.some((o) => o.id === itemId)) {
    errors.item_id = 'Invalid item';
  }

  const itemLabelRaw = raw.item_label != null ? String(raw.item_label).trim() : '';
  const catalogRow = catalog.find((o) => o.id === itemId);
  const item_label = itemLabelRaw || (catalogRow ? catalogRow.label.en : itemId);

  let quantity_sold: number | undefined;
  const qRaw = raw.quantity_sold;
  if (qRaw === undefined || qRaw === null || qRaw === '') {
    errors.quantity = 'Quantity is required';
  } else {
    const q = typeof qRaw === 'number' ? qRaw : Number(String(qRaw).trim());
    if (!Number.isFinite(q) || Math.floor(q) !== q) {
      errors.quantity = 'Quantity must be a whole number';
    } else if (q < QUANTITY_MIN || q > QUANTITY_MAX) {
      errors.quantity = `Quantity must be between ${QUANTITY_MIN} and ${QUANTITY_MAX}`;
    } else {
      quantity_sold = q;
    }
  }

  let amount_collected: number | undefined;
  const aRaw = raw.amount_collected;
  if (aRaw === undefined || aRaw === null || aRaw === '') {
    errors.amount = 'Amount collected is required';
  } else {
    const a = typeof aRaw === 'number' ? aRaw : Number(String(aRaw).trim());
    if (!Number.isFinite(a)) {
      errors.amount = 'Amount must be a number';
    } else if (a <= 0) {
      errors.amount = 'Amount collected must be greater than 0';
    } else if (a > AMOUNT_MAX) {
      errors.amount = `Amount collected cannot exceed ${AMOUNT_MAX}`;
    } else {
      amount_collected = a;
    }
  }

  const pmRaw = raw.payment_method != null ? String(raw.payment_method).trim() : '';
  if (!pmRaw) {
    errors.payment_method = 'Payment method is required';
  } else if (!isValidPaymentMethod(pmRaw)) {
    errors.payment_method = 'Invalid payment method';
  }
  const payment_method = pmRaw ? normalizePaymentMethod(pmRaw) : undefined;

  let notes: string | undefined;
  const noteRaw = raw.notes != null ? String(raw.notes) : '';
  const noteTrim = noteRaw.trim();
  if (noteTrim.length > NOTES_MAX) {
    errors.notes = `Notes cannot exceed ${NOTES_MAX} characters`;
  } else if (noteTrim) {
    notes = noteTrim;
  }

  const valid = Object.keys(errors).length === 0;
  return {
    valid,
    errors,
    ...(valid &&
    dateStr &&
    timeHm &&
    staff &&
    itemId &&
    quantity_sold != null &&
    amount_collected != null &&
    payment_method
      ? {
          date: dateStr,
          time: timeHm,
          staff_name: staff,
          item_id: itemId,
          item_label,
          quantity_sold,
          amount_collected,
          payment_method,
          notes,
        }
      : {}),
  };
}
