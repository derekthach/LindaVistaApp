import {
  DEFAULT_FOOD_PRICE_CENTS,
  PRICING_FOOD_ITEM_IDS,
} from '@/lib/pricing/defaultFoodPrices';
import {
  applyRoomPriceDraft,
  type RoomPriceMap,
} from '@/lib/pricing/roomPricing';

/** Item id → priceCents (same shape as room price maps for shared draft helpers). */
export type FoodPriceMap = RoomPriceMap;

export type PendingFoodPriceChange = {
  itemId: string;
  fromCents: number;
  toCents: number;
};

export function completeFoodPriceMap(
  stored: FoodPriceMap,
  defaults: FoodPriceMap = { ...DEFAULT_FOOD_PRICE_CENTS }
): FoodPriceMap {
  const out: FoodPriceMap = {};
  for (const itemId of PRICING_FOOD_ITEM_IDS) {
    const cents = stored[itemId] ?? defaults[itemId];
    if (typeof cents === 'number' && Number.isFinite(cents)) {
      out[itemId] = cents;
    }
  }
  return out;
}

/** Individual item draft — reuses room draft helper (string key → cents). */
export function applyFoodItemPriceDraft(
  persisted: FoodPriceMap,
  draft: FoodPriceMap,
  itemId: string,
  toCents: number
): FoodPriceMap {
  return applyRoomPriceDraft(persisted, draft, itemId, toCents);
}

/** Pending food changes in catalog order. */
export function listPendingFoodChanges(
  persisted: FoodPriceMap,
  draft: FoodPriceMap
): PendingFoodPriceChange[] {
  const changes: PendingFoodPriceChange[] = [];
  for (const itemId of PRICING_FOOD_ITEM_IDS) {
    const toCents = draft[itemId];
    const fromCents = persisted[itemId];
    if (typeof toCents !== 'number' || typeof fromCents !== 'number') continue;
    if (toCents === fromCents) continue;
    changes.push({ itemId, fromCents, toCents });
  }
  // Include any unexpected draft keys last (should not occur in normal use).
  for (const itemId of Object.keys(draft)) {
    if (PRICING_FOOD_ITEM_IDS.includes(itemId)) continue;
    const toCents = draft[itemId];
    const fromCents = persisted[itemId];
    if (typeof toCents !== 'number' || typeof fromCents !== 'number') continue;
    if (toCents === fromCents) continue;
    changes.push({ itemId, fromCents, toCents });
  }
  return changes;
}

export function hasPendingFoodChanges(persisted: FoodPriceMap, draft: FoodPriceMap): boolean {
  return listPendingFoodChanges(persisted, draft).length > 0;
}
