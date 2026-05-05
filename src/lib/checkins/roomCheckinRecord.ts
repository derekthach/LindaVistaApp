import type { CheckIn } from '@/types';

/**
 * Room stay vs food/beer for metrics (cars, employee counts, monthly car_count).
 * - Explicit food/beer → excluded.
 * - Explicit room → included.
 * - Legacy without checkInType: excluded if line/summary item rows exist (typical F&B shape); else treated as room.
 */
export function isRoomCheckinRecord(c: CheckIn): boolean {
  if (c.checkInType === 'food' || c.checkInType === 'beer') return false;
  if (c.checkInType === 'room') return true;
  const hasItemData =
    (Array.isArray(c.lineItems) && c.lineItems.length > 0) ||
    (Array.isArray(c.summarizedItems) && c.summarizedItems.length > 0);
  if (hasItemData) return false;
  return true;
}
