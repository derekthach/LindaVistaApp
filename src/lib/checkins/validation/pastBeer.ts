import { BEER_ITEMS } from '@/lib/checkins/items';
import {
  validatePastCatalogSaleAdmin,
  type PastCatalogSaleValidationResult,
} from '@/lib/checkins/validation/pastCatalogSale';

export type PastBeerValidationResult = PastCatalogSaleValidationResult;

export function validatePastBeerAdmin(
  raw: Record<string, unknown>,
  staffAllowlist: readonly string[]
): PastBeerValidationResult {
  return validatePastCatalogSaleAdmin(raw, staffAllowlist, BEER_ITEMS);
}
