import type { CheckIn, LineItem } from '@/types';

/** Prefer raw line items when present; otherwise expand summarized rows (legacy / grouped). */
export function lineItemsFromCheckinRecord(checkin: CheckIn): LineItem[] {
  const raw = checkin.lineItems;
  if (raw && raw.length > 0) {
    return raw.map((r) => ({
      itemId: r.itemId,
      itemLabel: r.itemLabel,
      quantitySold: r.quantitySold,
      amountCollected: r.amountCollected,
    }));
  }
  const sums = checkin.summarizedItems ?? [];
  return sums.map((s) => ({
    itemId: s.itemId,
    itemLabel: s.itemLabel,
    quantitySold: s.totalQuantitySold,
    amountCollected: s.totalAmountCollected,
  }));
}

export function foodBeerLineRowsSummary(lines: LineItem[]): string {
  if (!lines.length) return '';
  return lines
    .map((r) => `${r.itemLabel}: ${r.quantitySold} × $${Number(r.amountCollected).toFixed(2)}`)
    .join('; ');
}

export function foodBeerLineRowsAmountTotal(lines: LineItem[]): number {
  return lines.reduce((sum, r) => sum + (Number(r.amountCollected) || 0), 0);
}
