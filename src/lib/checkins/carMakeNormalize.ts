/** Max length aligned with room check-in validation (`car_make`). */
export const CAR_MAKE_MAX = 30;

/**
 * Trim, collapse internal whitespace to single spaces, uppercase, cap length.
 * Used for persistence and duplicate detection (e.g. " BMW " → "BMW").
 */
export function normalizeCarMakeName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, CAR_MAKE_MAX);
}
