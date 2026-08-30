import { FOOD_ITEMS } from '@/lib/checkins/items';

/**
 * Final Food & Drink rates (integer cents), keyed by stable {@link FOOD_ITEMS} ids.
 * Display names on the Pricing page follow the kitchen pricing sheet.
 */
export const DEFAULT_FOOD_PRICE_CENTS: Readonly<Record<string, number>> = Object.freeze({
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

/** Kitchen-sheet display labels for Admin Pricing (does not change employee item catalog labels). */
export const FOOD_PRICING_DISPLAY_LABELS: Readonly<
  Record<string, { en: string; es: string }>
> = Object.freeze({
  food_jugos: { en: 'Jugos / Juices', es: 'Jugos / Juices' },
  food_agua_de_coco: { en: 'Agua de Coco', es: 'Agua de Coco' },
  food_refrescos: { en: 'Refrescos / Soda', es: 'Refrescos / Soda' },
  food_agua: { en: 'Agua / Water', es: 'Agua / Water' },
  food_agua_tonica: { en: 'Agua Tónica', es: 'Agua Tónica' },
  food_frito_lay: { en: 'Frito Lay', es: 'Frito Lay' },
  food_travel_kit: { en: 'Travel Kit', es: 'Travel Kit' },
  food_alkaseltzer: { en: 'Alkaseltzer', es: 'Alkaseltzer' },
  food_panadol: { en: 'Panadol / Acetaminophen', es: 'Panadol / Acetaminofén' },
  food_condones: { en: 'Condones / Condoms', es: 'Condones / Condones' },
});

/** Stable Food & Drink item ids for Pricing (same order as {@link FOOD_ITEMS}). */
export const PRICING_FOOD_ITEM_IDS: readonly string[] = FOOD_ITEMS.map((item) => item.id);

export function isPricingFoodItemId(itemId: string): boolean {
  return PRICING_FOOD_ITEM_IDS.includes(itemId);
}

export function foodPricingDisplayLabel(
  itemId: string,
  language: 'en' | 'es'
): string {
  const labels = FOOD_PRICING_DISPLAY_LABELS[itemId];
  if (labels) return labels[language];
  const catalog = FOOD_ITEMS.find((i) => i.id === itemId);
  if (catalog) return catalog.label[language];
  return itemId;
}

export function assertDefaultFoodPricesCoverCatalog(): {
  missing: string[];
  extra: string[];
} {
  const expected = new Set(PRICING_FOOD_ITEM_IDS);
  const seeded = new Set(Object.keys(DEFAULT_FOOD_PRICE_CENTS));
  const missing = [...expected].filter((id) => !seeded.has(id));
  const extra = [...seeded].filter((id) => !expected.has(id));
  return { missing, extra };
}
