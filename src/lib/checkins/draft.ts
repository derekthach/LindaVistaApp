import type { LineItem, RoomPaymentSplit } from '@/types';
import { parsePaymentSplitsFromFirestore } from '@/lib/checkins/roomPaymentSplits';

export interface FoodBeerDraft {
  checkInType: 'food' | 'beer';
  date: string;
  time: string;
  staff_name: string;
  lineItems: LineItem[];
  notes?: string;
  /** First method / legacy single method. */
  payment_method: string;
  /** Multi-method splits when present (admin food/beer). */
  payment_splits?: RoomPaymentSplit[];
}

const DRAFT_KEY_FOOD = 'lv_checkin_draft_food';
const DRAFT_KEY_BEER = 'lv_checkin_draft_beer';

export function getDraftStorageKey(type: 'food' | 'beer'): string {
  return type === 'food' ? DRAFT_KEY_FOOD : DRAFT_KEY_BEER;
}

export function getDraft(type: 'food' | 'beer'): FoodBeerDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(getDraftStorageKey(type));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FoodBeerDraft;
    if (parsed?.checkInType !== type || !Array.isArray(parsed.lineItems)) return null;
    const payment_splits = parsePaymentSplitsFromFirestore(parsed.payment_splits);
    return {
      ...parsed,
      payment_method: typeof parsed.payment_method === 'string' ? parsed.payment_method : '',
      ...(payment_splits?.length ? { payment_splits } : {}),
    };
  } catch {
    return null;
  }
}

export function setDraft(draft: FoodBeerDraft): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(getDraftStorageKey(draft.checkInType), JSON.stringify(draft));
}

export function clearDraft(type: 'food' | 'beer'): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(getDraftStorageKey(type));
}
