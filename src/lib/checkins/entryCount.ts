import type { CheckIn } from '@/types';

/** Inclusive bounds for Admin Add Past Entry `# of Receipts Captured`. */
export const RECEIPTS_CAPTURED_MIN = 1;
export const RECEIPTS_CAPTURED_MAX = 100;

/**
 * How many underlying physical receipts / transactions one check-in document represents.
 * Missing or invalid values count as 1 (legacy + live check-ins). Never use for revenue.
 */
export function getEntryCount(
  checkin: Pick<CheckIn, 'receipts_captured'> | { receipts_captured?: number | null }
): number {
  const n = checkin.receipts_captured;
  if (typeof n !== 'number' || !Number.isFinite(n) || !Number.isInteger(n)) return 1;
  if (n < RECEIPTS_CAPTURED_MIN) return 1;
  if (n > RECEIPTS_CAPTURED_MAX) return RECEIPTS_CAPTURED_MAX;
  return n;
}

export type ParseReceiptsCapturedResult =
  | { ok: true; value: number | undefined }
  | { ok: false; errorKey: 'err_receipts_captured_invalid' };

/**
 * Parse optional form / patch input.
 * Blank / omitted → `{ ok: true, value: undefined }` (business count defaults to 1).
 * Valid integer 1–100 → `{ ok: true, value }`.
 */
export function parseReceiptsCapturedInput(raw: unknown): ParseReceiptsCapturedResult {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  const s = String(raw).trim();
  if (s === '') return { ok: true, value: undefined };

  if (!/^\d+$/.test(s)) {
    return { ok: false, errorKey: 'err_receipts_captured_invalid' };
  }
  const n = Number(s);
  if (!Number.isInteger(n) || n < RECEIPTS_CAPTURED_MIN || n > RECEIPTS_CAPTURED_MAX) {
    return { ok: false, errorKey: 'err_receipts_captured_invalid' };
  }
  return { ok: true, value: n };
}

/** Normalize a value already on a CheckIn / draft (edit UI). */
export function normalizeStoredReceiptsCaptured(raw: unknown): number | undefined {
  const parsed = parseReceiptsCapturedInput(raw);
  return parsed.ok ? parsed.value : undefined;
}
