import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  DEFAULT_FOOD_PRICE_CENTS,
  PRICING_FOOD_ITEM_IDS,
} from '@/lib/pricing/defaultFoodPrices';
import {
  completeFoodPriceMap,
  type FoodPriceMap,
} from '@/lib/pricing/foodPricing';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { isFirestoreUnavailableError, isProduction } from '@/lib/server/firestoreError';

export const FOOD_PRICES_COLLECTION = 'foodPrices';

function docIdForItem(itemId: string): string {
  return String(itemId).trim();
}

function parsePriceCents(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

/**
 * Load Food & Drink item → priceCents map.
 * Missing docs are seeded from kitchen-sheet defaults.
 * Does NOT touch check-ins or historical totals.
 */
export async function getFoodPricingMap(): Promise<FoodPriceMap> {
  try {
    const db = getAdminDb();
    const snapshot = await db.collection(FOOD_PRICES_COLLECTION).get();
    const stored: FoodPriceMap = {};
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const itemId = String(data.itemId ?? doc.id).trim();
      const cents = parsePriceCents(data.priceCents);
      if (!itemId || cents === null) continue;
      stored[itemId] = cents;
    }

    const complete = completeFoodPriceMap(stored, { ...DEFAULT_FOOD_PRICE_CENTS });
    await ensureMissingFoodPricesSeeded(stored, complete);
    return complete;
  } catch (err) {
    if (isFirestoreUnavailableError(err)) {
      if (isProduction()) throw err;
      console.warn(
        'Firestore unavailable (getFoodPricingMap), returning defaults:',
        (err as Error).message
      );
      return completeFoodPriceMap({}, { ...DEFAULT_FOOD_PRICE_CENTS });
    }
    throw err;
  }
}

async function ensureMissingFoodPricesSeeded(
  stored: FoodPriceMap,
  complete: FoodPriceMap
): Promise<void> {
  const missing = PRICING_FOOD_ITEM_IDS.filter((id) => stored[id] === undefined);
  if (missing.length === 0) return;

  const db = getAdminDb();
  const batch = db.batch();
  const now = Timestamp.now();
  for (const itemId of missing) {
    const cents = complete[itemId];
    if (typeof cents !== 'number') continue;
    const ref = db.collection(FOOD_PRICES_COLLECTION).doc(docIdForItem(itemId));
    batch.set(
      ref,
      {
        itemId,
        priceCents: cents,
        updatedAt: now,
        updatedBy: null,
        seededAt: now,
      },
      { merge: true }
    );
  }
  await batch.commit();
}

export type FoodPriceUpdate = {
  itemId: string;
  priceCents: number;
};

/**
 * Atomically persist Food & Drink price updates.
 * Only updates `foodPrices` — never check-ins.
 */
export async function saveFoodPricesBatch(
  updates: FoodPriceUpdate[],
  updatedBy: string
): Promise<void> {
  if (updates.length === 0) return;

  const db = getAdminDb();
  const batch = db.batch();
  const now = FieldValue.serverTimestamp();
  const by = updatedBy.trim() || null;

  for (const { itemId, priceCents } of updates) {
    const id = docIdForItem(itemId);
    if (!id) throw new Error(`Invalid item id: ${itemId}`);
    if (!Number.isInteger(priceCents) || priceCents <= 0) {
      throw new Error(`Invalid priceCents for item ${id}`);
    }
    const ref = db.collection(FOOD_PRICES_COLLECTION).doc(id);
    batch.set(
      ref,
      {
        itemId: id,
        priceCents,
        updatedAt: now,
        updatedBy: by,
      },
      { merge: true }
    );
  }

  await batch.commit();
}
