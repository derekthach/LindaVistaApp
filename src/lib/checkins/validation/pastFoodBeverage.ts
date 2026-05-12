import { FOOD_ITEMS } from '@/lib/checkins/items';
import {
  validatePastCatalogSaleAdmin,
  type PastCatalogSaleValidationResult,
} from '@/lib/checkins/validation/pastCatalogSale';

export type PastFoodBeverageValidationResult = PastCatalogSaleValidationResult;

export function validatePastFoodBeverageAdmin(
  raw: Record<string, unknown>,
  staffAllowlist: readonly string[]
): PastFoodBeverageValidationResult {
  return validatePastCatalogSaleAdmin(raw, staffAllowlist, FOOD_ITEMS);
}
