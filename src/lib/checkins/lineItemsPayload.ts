import type { LineItem } from '@/types';

const QUANTITY_MIN = 1;
const QUANTITY_MAX = 50;

/** Parse JSON string or raw array bodies into loosely-typed rows (validated elsewhere). */
export function parseLineItemsFromUnknown(value: unknown): LineItem[] | null {
  let arr: unknown[];
  if (typeof value === 'string' && value.trim()) {
    try {
      const p = JSON.parse(value) as unknown;
      arr = Array.isArray(p) ? p : [];
    } catch {
      return null;
    }
  } else if (Array.isArray(value)) {
    arr = value;
  } else {
    return null;
  }

  const out: LineItem[] = [];
  for (const row of arr) {
    if (typeof row !== 'object' || row === null) return null;
    const r = row as Record<string, unknown>;
    const itemId = String(r.itemId ?? '').trim();
    const itemLabel = String(r.itemLabel ?? '').trim();
    const quantitySold =
      typeof r.quantitySold === 'number'
        ? r.quantitySold
        : Number(String(r.quantitySold ?? '').trim());
    const amountCollected =
      typeof r.amountCollected === 'number'
        ? r.amountCollected
        : Number(String(r.amountCollected ?? '').trim());
    out.push({
      itemId,
      itemLabel,
      quantitySold,
      amountCollected,
    });
  }
  return out;
}

/** Persistable rows matching normal food/beer check-in submit shape. */
export function normalizeSubmittedFoodBeerLineItems(items: LineItem[]): LineItem[] {
  return items
    .filter((r) => r.itemId?.trim())
    .map((r) => ({
      itemId: r.itemId.trim(),
      itemLabel: (r.itemLabel || r.itemId).trim(),
      quantitySold: Math.min(QUANTITY_MAX, Math.max(QUANTITY_MIN, Math.floor(Number(r.quantitySold) || 1))),
      amountCollected: Number(r.amountCollected) || 0,
    }));
}
