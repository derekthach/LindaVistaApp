import type { CheckIn, RoomPaymentSplit } from '@/types';
import {
  type PaymentMethodValue,
  normalizePaymentMethod,
  isValidPaymentMethod,
} from '@/lib/checkins/paymentMethods';

const METHOD_LABEL_EN: Record<PaymentMethodValue, string> = {
  cash: 'CASH',
  ath_mobil: 'ATH Móvil',
  venmo: 'Venmo',
  paypal: 'PayPal',
  cash_app: 'Cash App',
};

const COST_MAX = 1000;

export function getRoomPaymentMethodEnglishLabel(method: string): string {
  const m = normalizePaymentMethod(method);
  return METHOD_LABEL_EN[m];
}

export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function calculatePaymentSplitTotal(splits: RoomPaymentSplit[]): number {
  return roundMoney(splits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0));
}

/** Compact: `CASH $40.00, ATH Móvil $25.00` */
export function formatPaymentBreakdownComma(splits: RoomPaymentSplit[]): string {
  return splits
    .map((s) => `${getRoomPaymentMethodEnglishLabel(s.method)} $${Number(s.amount).toFixed(2)}`)
    .join(', ');
}

/** CSV / pipe: `CASH $40.00 | ATH Móvil $25.00` */
export function formatPaymentBreakdownPipe(splits: RoomPaymentSplit[]): string {
  return splits
    .map((s) => `${getRoomPaymentMethodEnglishLabel(s.method)} $${Number(s.amount).toFixed(2)}`)
    .join(' | ');
}

/** One readable line per split for detail UI. */
export function formatPaymentBreakdownLines(splits: RoomPaymentSplit[]): string[] {
  return splits.map(
    (s) => `${getRoomPaymentMethodEnglishLabel(s.method)}: $${Number(s.amount).toFixed(2)}`
  );
}

export function parsePaymentSplitsFromFirestore(raw: unknown): RoomPaymentSplit[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: RoomPaymentSplit[] = [];
  for (const row of raw) {
    if (row == null || typeof row !== 'object') continue;
    const m = (row as { method?: string }).method;
    if (!isValidPaymentMethod(String(m))) continue;
    const method = normalizePaymentMethod(m);
    const amount = Number((row as { amount?: unknown }).amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    out.push({ method, amount: roundMoney(amount) });
  }
  return out.length > 0 ? out : undefined;
}

export interface ValidatePaymentSplitsResult {
  valid: boolean;
  error?: string;
  splits?: RoomPaymentSplit[];
}

/**
 * At least one row; each row valid method, amount > 0, ≤ COST_MAX per row, total ≤ COST_MAX; no duplicate methods.
 */
export function validatePaymentSplits(raw: unknown): ValidatePaymentSplitsResult {
  let arr: unknown[];
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return { valid: false, error: 'Add at least one payment row' };
    try {
      arr = JSON.parse(t) as unknown[];
    } catch {
      return { valid: false, error: 'Invalid payment data' };
    }
  } else if (Array.isArray(raw)) {
    arr = raw;
  } else {
    return { valid: false, error: 'Add at least one payment row' };
  }

  if (!Array.isArray(arr) || arr.length === 0) {
    return { valid: false, error: 'Add at least one payment row' };
  }

  const seen = new Set<PaymentMethodValue>();
  const splits: RoomPaymentSplit[] = [];

  for (const row of arr) {
    if (row == null || typeof row !== 'object') {
      return { valid: false, error: 'Each payment row must have a method and amount' };
    }
    const methodRaw = (row as { method?: unknown }).method;
    const amountRaw = (row as { amount?: unknown }).amount;
    const methodStr = methodRaw != null ? String(methodRaw).trim() : '';
    if (!methodStr || !isValidPaymentMethod(methodStr)) {
      return { valid: false, error: 'Select a valid payment method for each row' };
    }
    const method = normalizePaymentMethod(methodStr);
    if (seen.has(method)) {
      return { valid: false, error: 'Each payment method can only be used once' };
    }
    seen.add(method);

    if (amountRaw === undefined || amountRaw === null || amountRaw === '') {
      return { valid: false, error: 'Enter an amount greater than 0 for each row' };
    }
    const amount = Number(amountRaw);
    if (Number.isNaN(amount)) {
      return { valid: false, error: 'Each amount must be a valid number' };
    }
    const rounded = roundMoney(amount);
    if (rounded <= 0) {
      return { valid: false, error: 'Each amount must be greater than 0' };
    }
    if (rounded > COST_MAX) {
      return { valid: false, error: `Each row cannot exceed $${COST_MAX}` };
    }
    splits.push({ method, amount: rounded });
  }

  const total = calculatePaymentSplitTotal(splits);
  if (total > COST_MAX) {
    return { valid: false, error: `Total collected cannot exceed $${COST_MAX}` };
  }

  return { valid: true, splits };
}

/** Normalized total for room check-in (split-based or legacy cost). */
export function getRoomCollectedTotal(checkin: CheckIn): number {
  const splits = checkin.payment_splits;
  if (splits && splits.length > 0) {
    return calculatePaymentSplitTotal(splits);
  }
  const n = Number(checkin.cost);
  return Number.isNaN(n) ? 0 : roundMoney(Math.max(0, n));
}

/**
 * Readable breakdown for room: splits if present, else single legacy line from payment_method + cost.
 */
export function getRoomPaymentBreakdownDisplay(checkin: CheckIn): {
  lines: string[];
  compactComma: string;
  compactPipe: string;
  total: number;
} {
  const splits = checkin.payment_splits;
  const total = getRoomCollectedTotal(checkin);
  if (splits && splits.length > 0) {
    return {
      lines: formatPaymentBreakdownLines(splits),
      compactComma: formatPaymentBreakdownComma(splits),
      compactPipe: formatPaymentBreakdownPipe(splits),
      total,
    };
  }
  const pm = checkin.payment_method ? getRoomPaymentMethodEnglishLabel(checkin.payment_method) : '—';
  const line = `${pm}: $${total.toFixed(2)}`;
  return {
    lines: [line],
    compactComma: `${pm} $${total.toFixed(2)}`,
    compactPipe: `${pm} $${total.toFixed(2)}`,
    total,
  };
}

/** Audit string for a Firestore room doc (before/after snapshots). */
export function formatPaymentBreakdownForAuditDoc(data: Record<string, unknown>): string {
  const splits = parsePaymentSplitsFromFirestore(data.paymentSplits);
  if (splits && splits.length > 0) {
    return formatPaymentBreakdownComma(splits);
  }
  const cost = Number(data.cost) || 0;
  const pm = normalizePaymentMethod((data.paymentMethod ?? data.payment) as string | undefined);
  return `${getRoomPaymentMethodEnglishLabel(pm)} $${cost.toFixed(2)}`;
}

export function getRoomCollectedTotalFromDoc(data: Record<string, unknown>): number {
  const splits = parsePaymentSplitsFromFirestore(data.paymentSplits);
  if (splits && splits.length > 0) {
    return calculatePaymentSplitTotal(splits);
  }
  return roundMoney(Number(data.cost) || 0);
}

export type { RoomPaymentSplit };
