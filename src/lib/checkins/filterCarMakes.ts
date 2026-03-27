/** Case-insensitive contains match for car make search. */
export function filterCarMakes(makes: readonly string[], query: string): string[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery === '') return [...makes];
  return makes.filter((make) => make.toLowerCase().includes(normalizedQuery));
}

/**
 * True if `candidate` matches an existing make ignoring case (full-string equality).
 */
export function hasCarMakeDuplicateIgnoreCase(
  options: readonly string[],
  candidateTrimmed: string
): boolean {
  const t = candidateTrimmed.trim().toLowerCase();
  if (!t) return false;
  return options.some((o) => o.toLowerCase() === t);
}

/**
 * Offer "add new" only when the filter has zero substring matches, query is non-empty after trim,
 * and no existing make equals the trimmed query ignoring case.
 */
export function shouldOfferAddNewCarMake(
  options: readonly string[],
  filterText: string
): { offer: false } | { offer: true; trimmed: string } {
  const trimmed = filterText.trim();
  if (!trimmed) return { offer: false };
  const filtered = filterCarMakes(options, filterText);
  if (filtered.length > 0) return { offer: false };
  if (hasCarMakeDuplicateIgnoreCase(options, trimmed)) return { offer: false };
  return { offer: true, trimmed };
}
