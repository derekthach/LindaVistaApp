import type { CheckIn, RoomPaymentSplit } from '@/types';

/**
 * Canonical payment method values (stored in DB/Firestore).
 * Use getPaymentMethodLabel() for display; labels are in LanguageToggle.
 */
export const PAYMENT_METHODS = [
  'cash',
  'ath_mobil',
  'venmo',
  'paypal',
  'cash_app',
] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

/** Default when value is missing or invalid (backward compat). */
export const DEFAULT_PAYMENT_METHOD: PaymentMethodValue = 'cash';

/** Check if a string is a valid stored payment method. */
export function isValidPaymentMethod(value: string): value is PaymentMethodValue {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

/**
 * Normalize raw value for storage: accept known values; map legacy "Cash" to "cash"; otherwise default.
 */
export function normalizePaymentMethod(value: string | undefined | null): PaymentMethodValue {
  const s = value != null ? String(value).trim().toLowerCase() : '';
  if (s === 'cash') return 'cash';
  if (PAYMENT_METHODS.includes(s as PaymentMethodValue)) return s as PaymentMethodValue;
  return DEFAULT_PAYMENT_METHOD;
}

/** Translation key for display (LanguageToggle: cash, ath_mobil, venmo, paypal, cash_app). */
export function getPaymentMethodTranslationKey(value: string): PaymentMethodValue {
  const normalized = normalizePaymentMethod(value);
  return normalized;
}

/** True when a single stored method is present and canonical (food/beer or room single-method reads). */
export function hasStoredPaymentMethodSingle(value: string | undefined | null): boolean {
  const s = value != null ? String(value).trim().toLowerCase() : '';
  return s !== '' && (PAYMENT_METHODS as readonly string[]).includes(s);
}

/**
 * Display-layer payment methods for a check-in (methods only, no amounts).
 * Prefers `payment_splits` when present; otherwise legacy `payment_method`.
 * Does not invent defaults for missing/invalid historical data.
 */
export function getCheckInPaymentMethodValues(
  checkin: Pick<CheckIn, 'payment_method' | 'payment_splits'>
): PaymentMethodValue[] {
  const splits = checkin.payment_splits;
  if (Array.isArray(splits) && splits.length > 0) {
    const fromSplits = uniqueValidPaymentMethods(splits);
    if (fromSplits.length > 0) return fromSplits;
  }
  if (hasStoredPaymentMethodSingle(checkin.payment_method)) {
    return [getPaymentMethodTranslationKey(String(checkin.payment_method))];
  }
  return [];
}

function uniqueValidPaymentMethods(splits: RoomPaymentSplit[]): PaymentMethodValue[] {
  const seen = new Set<PaymentMethodValue>();
  const out: PaymentMethodValue[] = [];
  for (const split of splits) {
    if (!hasStoredPaymentMethodSingle(split?.method)) continue;
    const method = getPaymentMethodTranslationKey(String(split.method));
    if (seen.has(method)) continue;
    seen.add(method);
    out.push(method);
  }
  return out;
}
