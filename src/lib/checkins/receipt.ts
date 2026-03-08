/**
 * Shared receipt number utilities. Display format is 5-digit zero-padded (00000–99999).
 * Values > 99999 are allowed for increment continuity; they format without leading zeros.
 */

export const RECEIPT_DIGITS = 5;
export const RECEIPT_MAX = 99_999;

/**
 * Format a receipt value for display/storage: 5-character zero-padded string.
 * Values 0–99999 pad to 5 digits; values >= 100000 return as string (no pad).
 */
export function formatReceiptNumber(value: string | number): string {
  const s = typeof value === 'number' ? String(value) : String(value).trim();
  if (s === '') return '';
  const num = parseInt(s, 10);
  if (Number.isNaN(num) || num < 0) return s;
  if (num <= RECEIPT_MAX) return num.toString().padStart(RECEIPT_DIGITS, '0');
  return num.toString();
}

/**
 * Normalize user input to a valid receipt string (0–99999). Returns null if invalid.
 * Used for validation and before saving.
 */
export function normalizeReceiptNumber(input: string): string | null {
  const trimmed = String(input).trim();
  if (trimmed === '') return null;
  const num = parseInt(trimmed, 10);
  if (Number.isNaN(num) || num < 0 || num > RECEIPT_MAX) return null;
  return num.toString().padStart(RECEIPT_DIGITS, '0');
}

/**
 * Parse receipt string to number for increment math.
 */
export function parseReceiptNumber(value: string): number {
  const s = String(value).trim();
  const num = parseInt(s, 10);
  return Number.isNaN(num) || num < 0 ? 0 : num;
}

/**
 * Next receipt number after the given value (e.g. 01239 -> 01240).
 * Used when persisting "next" after a room check-in; does not wrap.
 */
export function incrementReceiptNumber(value: string): string {
  const num = parseReceiptNumber(value);
  const next = num + 1;
  return next <= RECEIPT_MAX
    ? next.toString().padStart(RECEIPT_DIGITS, '0')
    : next.toString();
}
