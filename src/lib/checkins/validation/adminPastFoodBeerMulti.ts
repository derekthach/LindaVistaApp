import { DateTime } from 'luxon';
import type { ItemOption } from '@/lib/checkins/items';
import type { LineItem } from '@/types';
import { validateFoodBeerLineItemsRows } from '@/lib/checkins/validation';
import { isValidPaymentMethod, normalizePaymentMethod } from '@/lib/checkins/paymentMethods';
import { parseLineItemsFromUnknown, normalizeSubmittedFoodBeerLineItems } from '@/lib/checkins/lineItemsPayload';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const NOTES_MAX = 250;

export interface AdminPastFoodBeerMultiResult {
  valid: boolean;
  error?: string;
  date?: string;
  time?: string;
  staff_name?: string;
  lineItems?: LineItem[];
  payment_method?: string;
  notes?: string;
}

/**
 * Admin Add Past Entry: food or beer with multiple catalog line items.
 * Same row rules as normal simple check-in (validateFoodBeerLineItemsRows).
 */
export function validateAdminPastFoodBeerMulti(
  raw: Record<string, unknown>,
  staffAllowlist: readonly string[],
  catalog: readonly ItemOption[]
): AdminPastFoodBeerMultiResult {
  const dateStr = raw.date != null ? String(raw.date).trim() : '';
  if (!dateStr) {
    return { valid: false, error: 'Date is required' };
  }
  if (!DATE_RE.test(dateStr)) {
    return { valid: false, error: 'Invalid date format (YYYY-MM-DD)' };
  }
  const d = DateTime.fromISO(dateStr, { zone: 'America/Puerto_Rico' });
  if (!d.isValid) {
    return { valid: false, error: 'Invalid date' };
  }

  const timeStr = raw.time != null ? String(raw.time).trim() : '';
  const timeHm = timeStr.slice(0, 5);
  if (!timeStr) {
    return { valid: false, error: 'Time is required' };
  }
  if (!TIME_RE.test(timeHm)) {
    return { valid: false, error: 'Invalid time format (HH:mm, 24-hour)' };
  }

  const staff = raw.staff_name != null ? String(raw.staff_name).trim() : '';
  if (!staff) {
    return { valid: false, error: 'Staff attribution is required' };
  }
  if (!staffAllowlist.includes(staff)) {
    return { valid: false, error: 'Staff must be selected from the allowed list' };
  }

  const pmRaw = raw.payment_method != null ? String(raw.payment_method).trim() : '';
  if (!pmRaw) {
    return { valid: false, error: 'Payment method is required' };
  }
  if (!isValidPaymentMethod(pmRaw)) {
    return { valid: false, error: 'Invalid payment method' };
  }
  const payment_method = normalizePaymentMethod(pmRaw);

  let notes: string | undefined;
  const noteRaw = raw.notes != null ? String(raw.notes) : '';
  const noteTrim = noteRaw.trim();
  if (noteTrim.length > NOTES_MAX) {
    return { valid: false, error: `Notes cannot exceed ${NOTES_MAX} characters` };
  }
  if (noteTrim) {
    notes = noteTrim;
  }

  const parsed = parseLineItemsFromUnknown(raw.lineItems);
  if (parsed === null) {
    return { valid: false, error: 'Invalid items data.' };
  }

  const lineItemValidation = validateFoodBeerLineItemsRows(parsed);
  if (lineItemValidation.errors.lineItems) {
    return { valid: false, error: 'At least one item row with item, quantity, and amount is required.' };
  }
  if (lineItemValidation.errors.itemsTotal) {
    return { valid: false, error: 'Total amount exceeds the allowed maximum for one check-in.' };
  }
  if (Object.keys(lineItemValidation.lineItemErrors).length > 0) {
    return { valid: false, error: 'Fix quantity and amount on each item row.' };
  }

  const normalized = normalizeSubmittedFoodBeerLineItems(parsed);
  for (const row of normalized) {
    if (!catalog.some((o) => o.id === row.itemId)) {
      return { valid: false, error: 'Invalid item' };
    }
  }

  return {
    valid: true,
    date: dateStr,
    time: timeHm,
    staff_name: staff,
    lineItems: normalized,
    payment_method,
    notes,
  };
}
