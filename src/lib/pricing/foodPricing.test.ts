import { describe, expect, it } from 'vitest';
import {
  assertDefaultFoodPricesCoverCatalog,
  DEFAULT_FOOD_PRICE_CENTS,
  PRICING_FOOD_ITEM_IDS,
} from '@/lib/pricing/defaultFoodPrices';
import {
  applyFoodItemPriceDraft,
  completeFoodPriceMap,
  listPendingFoodChanges,
} from '@/lib/pricing/foodPricing';
import { FOOD_ITEMS } from '@/lib/checkins/items';

describe('defaultFoodPrices', () => {
  it('covers exactly FOOD_ITEMS with kitchen-sheet seed rates', () => {
    const { missing, extra } = assertDefaultFoodPricesCoverCatalog();
    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
    expect(PRICING_FOOD_ITEM_IDS).toEqual(FOOD_ITEMS.map((i) => i.id));
    expect(DEFAULT_FOOD_PRICE_CENTS).toMatchObject({
      food_jugos: 200,
      food_agua_de_coco: 250,
      food_refrescos: 125,
      food_agua: 125,
      food_agua_tonica: 200,
      food_frito_lay: 150,
      food_travel_kit: 400,
      food_alkaseltzer: 100,
      food_panadol: 100,
      food_condones: 400,
    });
  });
});

describe('foodPricing drafts', () => {
  const persisted = completeFoodPriceMap({});

  it('drafts a single item without auto-saving others', () => {
    const draft = applyFoodItemPriceDraft(persisted, {}, 'food_agua_de_coco', 300);
    expect(listPendingFoodChanges(persisted, draft)).toEqual([
      { itemId: 'food_agua_de_coco', fromCents: 250, toCents: 300 },
    ]);
  });

  it('lists multiple pending changes in catalog order', () => {
    let draft = applyFoodItemPriceDraft(persisted, {}, 'food_frito_lay', 175);
    draft = applyFoodItemPriceDraft(persisted, draft, 'food_agua_de_coco', 300);
    expect(listPendingFoodChanges(persisted, draft).map((c) => c.itemId)).toEqual([
      'food_agua_de_coco',
      'food_frito_lay',
    ]);
  });
});
