'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/server/auth/session';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { isPricingFoodItemId } from '@/lib/pricing/defaultFoodPrices';
import { parsePriceInput } from '@/lib/pricing/roomPricing';
import {
  getFoodPricingMap,
  saveFoodPricesBatch,
  type FoodPriceUpdate,
} from '@/lib/server/foodPricingRepo';
import { HttpError } from '@/lib/server/httpError';

export type SaveFoodPricingResult =
  | { ok: true }
  | { ok: false; error: string };

type ChangeInput = {
  itemId: string;
  priceCents?: number;
  price?: string;
};

/**
 * Persist pending Food & Drink price changes (admin only).
 * Configuration only — does not modify check-in documents or historical totals.
 */
export async function saveFoodPricingAction(
  changes: ChangeInput[]
): Promise<SaveFoodPricingResult> {
  const session = await requireAuth('admin');
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof HttpError) {
      return { ok: false, error: 'Unauthorized.' };
    }
    throw e;
  }

  try {
    if (!Array.isArray(changes) || changes.length === 0) {
      return { ok: false, error: 'No pricing changes to save.' };
    }

    const current = await getFoodPricingMap();
    const updates: FoodPriceUpdate[] = [];
    const seen = new Set<string>();

    for (const change of changes) {
      const itemId = String(change?.itemId ?? '').trim();
      if (!itemId || !isPricingFoodItemId(itemId)) {
        return { ok: false, error: `Invalid item: ${itemId || '(empty)'}` };
      }
      if (seen.has(itemId)) {
        return { ok: false, error: `Duplicate item in changes: ${itemId}` };
      }
      seen.add(itemId);

      let priceCents: number | undefined =
        typeof change.priceCents === 'number' ? change.priceCents : undefined;
      if (priceCents === undefined && typeof change.price === 'string') {
        const parsed = parsePriceInput(change.price);
        if (!parsed.ok) {
          return { ok: false, error: `Invalid price for item ${itemId}.` };
        }
        priceCents = parsed.cents;
      }
      if (
        typeof priceCents !== 'number' ||
        !Number.isInteger(priceCents) ||
        priceCents <= 0
      ) {
        return { ok: false, error: `Invalid price for item ${itemId}.` };
      }

      if (current[itemId] === priceCents) continue;
      updates.push({ itemId, priceCents });
    }

    if (updates.length === 0) {
      return { ok: false, error: 'No pricing changes to save.' };
    }

    await saveFoodPricesBatch(updates, session.username ?? 'admin');
    revalidatePath('/admin/pricing');
    return { ok: true };
  } catch (e) {
    console.error('[saveFoodPricingAction]', e);
    return { ok: false, error: 'Could not save food pricing. Please try again.' };
  }
}
