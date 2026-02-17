import type { LineItem, SummarizedItem } from '@/types';

/**
 * Build summarized items by grouping raw line items by itemId.
 * Uses the first encountered itemLabel per itemId for consistency.
 */
export function summarizeLineItems(raw: LineItem[]): SummarizedItem[] {
  const map = new Map<string, SummarizedItem>();
  for (const row of raw) {
    const key = row.itemId;
    const current = map.get(key) ?? {
      itemId: key,
      itemLabel: row.itemLabel,
      totalQuantitySold: 0,
      totalAmountCollected: 0,
    };
    current.totalQuantitySold += row.quantitySold;
    current.totalAmountCollected += row.amountCollected;
    map.set(key, current);
  }
  return Array.from(map.values());
}
