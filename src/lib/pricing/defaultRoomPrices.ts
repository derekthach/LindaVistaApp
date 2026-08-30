import { ROOM_OPTIONS, type RoomId } from '@/lib/checkins/rooms';

/**
 * Final current room rates (integer cents). Source of truth for seeding only —
 * runtime prices live in Firestore `roomPrices/{roomId}`.
 *
 * There is NO $33 tier.
 */
export const DEFAULT_ROOM_PRICE_CENTS: Readonly<Record<string, number>> = Object.freeze({
  '40': 8000,
  '1': 6500,
  '2': 6500,
  '3': 6500,
  '38': 6500,
  '41': 5000,
  '42': 5000,
  '43': 5000,
  '44': 5000,
  '45': 5000,
  '46': 5000,
  '47': 5000,
  '48': 5000,
  '14A': 4300,
  '14B': 4300,
  '15A': 4300,
  '15B': 4300,
  '16': 3500,
  '17': 3500,
  '18': 3500,
  '19': 3500,
  '20': 3500,
  '21': 3500,
  '22': 2800,
  '23': 2800,
  '24': 2800,
  '25': 2800,
  '26': 2800,
  '27': 2800,
  '28': 2800,
  '29': 2800,
});

/** Rooms that must appear on the Pricing page (same as new check-in options). */
export const PRICING_ROOM_IDS: readonly RoomId[] = ROOM_OPTIONS;

export function defaultPriceCentsForRoom(roomId: RoomId | string): number | undefined {
  return DEFAULT_ROOM_PRICE_CENTS[String(roomId)];
}

/** Assert seed covers exactly {@link PRICING_ROOM_IDS} (used in tests). */
export function assertDefaultRoomPricesCoverCatalog(): {
  missing: string[];
  extra: string[];
} {
  const expected = new Set(PRICING_ROOM_IDS.map((r) => String(r)));
  const seeded = new Set(Object.keys(DEFAULT_ROOM_PRICE_CENTS));
  const missing = [...expected].filter((id) => !seeded.has(id));
  const extra = [...seeded].filter((id) => !expected.has(id));
  return { missing, extra };
}
