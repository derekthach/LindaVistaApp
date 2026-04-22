import { normalizeCarMakeName } from '@/lib/checkins/carMakeNormalize';

/** Case-insensitive contains match for car make search (whitespace-normalized query). */
export function filterCarMakes(makes: readonly string[], query: string): string[] {
  const normalizedQuery = normalizeCarMakeName(query).toLowerCase();
  if (normalizedQuery === '') return [...makes];
  return makes.filter((make) => make.toLowerCase().includes(normalizedQuery));
}

/**
 * True if `candidate` matches an existing make after normalization (case + whitespace).
 */
export function hasCarMakeDuplicateIgnoreCase(
  options: readonly string[],
  candidateRaw: string
): boolean {
  const n = normalizeCarMakeName(candidateRaw);
  if (!n) return false;
  return options.some((o) => normalizeCarMakeName(o) === n);
}

/**
 * Offer "add new" only when the filter has zero substring matches, query is non-empty after trim,
 * and no existing make equals the normalized query.
 */
export function shouldOfferAddNewCarMake(
  options: readonly string[],
  filterText: string
): { offer: false } | { offer: true; trimmed: string } {
  const normalized = normalizeCarMakeName(filterText);
  if (!normalized) return { offer: false };
  const filtered = filterCarMakes(options, filterText);
  if (filtered.length > 0) return { offer: false };
  if (hasCarMakeDuplicateIgnoreCase(options, filterText)) return { offer: false };
  return { offer: true, trimmed: normalized };
}
