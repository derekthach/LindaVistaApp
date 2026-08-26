import { DateTime } from 'luxon';
import type { ItemOption } from '@/lib/checkins/items';
import type { LineItem, RoomPaymentSplit } from '@/types';
import { validateFoodBeerLineItemsRows } from '@/lib/checkins/validation';
import {
  calculatePaymentSplitTotal,
  ADMIN_PAST_ENTRY_PAYMENT_SPLIT_OPTIONS,
  roundMoney,
  validatePaymentSplitsForExpectedTotal,
} from '@/lib/checkins/roomPaymentSplits';
import { parseLineItemsFromUnknown, normalizeSubmittedFoodBeerLineItems } from '@/lib/checkins/lineItemsPayload';
import { parseReceiptsCapturedInput } from '@/lib/checkins/entryCount';

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
  payment_splits?: RoomPaymentSplit[];
  notes?: string;
  receipts_captured?: number;
}

/**
 * Admin Add Past Entry: food or beer with multiple catalog line items.
 * Payment may be a multi-method breakdown whose total must equal line-item total.
 * Amounts may be up to $5000 per row and $5000 combined (past-entry only).
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

  const lineItemValidation = validateFoodBeerLineItemsRows(parsed, {
    maxAmountPerRow: ADMIN_PAST_ENTRY_PAYMENT_SPLIT_OPTIONS.maxRowAmount,
    maxTotal: ADMIN_PAST_ENTRY_PAYMENT_SPLIT_OPTIONS.maxTotal,
  });
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

  const lineTotal = roundMoney(
    normalized.reduce((sum, r) => sum + (Number(r.amountCollected) || 0), 0)
  );

  const hasSplitsField =
    raw.payment_splits != null &&
    raw.payment_splits !== '' &&
    !(typeof raw.payment_splits === 'string' && String(raw.payment_splits).trim() === '');

  if (!hasSplitsField) {
    return { valid: false, error: 'Payment breakdown is required' };
  }

  const splitResult = validatePaymentSplitsForExpectedTotal(
    raw.payment_splits,
    lineTotal,
    ADMIN_PAST_ENTRY_PAYMENT_SPLIT_OPTIONS
  );
  if (!splitResult.valid || !splitResult.splits?.length) {
    if (splitResult.error === 'err_payment_total_mismatch') {
      const expected = (splitResult.expectedTotal ?? lineTotal).toFixed(2);
      const assigned = (
        splitResult.assignedTotal ?? calculatePaymentSplitTotal(splitResult.splits ?? [])
      ).toFixed(2);
      const remaining = Math.max(
        0,
        Math.round(
          ((splitResult.expectedTotal ?? lineTotal) -
            (splitResult.assignedTotal ?? calculatePaymentSplitTotal(splitResult.splits ?? []))) *
            100
        ) / 100
      ).toFixed(2);
      return {
        valid: false,
        error: `Payment methods must total $${expected}. Currently assigned: $${assigned}. Remaining: $${remaining}.`,
      };
    }
    return { valid: false, error: 'Invalid payment breakdown' };
  }

  const receiptsParsed = parseReceiptsCapturedInput(raw.receipts_captured);
  if (!receiptsParsed.ok) {
    return { valid: false, error: 'Enter a whole number from 1 to 100 for receipts captured, or leave blank' };
  }

  return {
    valid: true,
    date: dateStr,
    time: timeHm,
    staff_name: staff,
    lineItems: normalized,
    payment_method: splitResult.splits[0].method,
    payment_splits: splitResult.splits,
    notes,
    ...(receiptsParsed.value != null ? { receipts_captured: receiptsParsed.value } : {}),
  };
}
