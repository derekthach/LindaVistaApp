import { FULL_ROOM_CATALOG, type RoomId } from '@/lib/checkins/rooms';
import { PRICING_ROOM_IDS } from '@/lib/pricing/defaultRoomPrices';

export type RoomPriceMap = Record<string, number>; // roomId string → priceCents

export type PriceGroup = {
  priceCents: number;
  roomIds: string[];
};

export type PendingPriceChange = {
  roomId: string;
  fromCents: number;
  toCents: number;
};

const ROOM_ORDER = new Map(FULL_ROOM_CATALOG.map((r, i) => [String(r), i]));

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

/** Display as `$50.00`. */
export function formatPriceCents(cents: number): string {
  return `$${centsToDollars(cents).toFixed(2)}`;
}

/**
 * Natural room order (catalog order), not lexicographic.
 * Unknown ids sort after known catalog rooms.
 */
export function compareRoomIds(a: string | RoomId, b: string | RoomId): number {
  const sa = String(a);
  const sb = String(b);
  const ia = ROOM_ORDER.get(sa) ?? 10000;
  const ib = ROOM_ORDER.get(sb) ?? 10000;
  if (ia !== ib) return ia - ib;
  return sa.localeCompare(sb, undefined, { numeric: true });
}

export function sortRoomIds(roomIds: readonly (string | RoomId)[]): string[] {
  return [...roomIds].map(String).sort(compareRoomIds);
}

/**
 * Effective prices: draft overrides win over persisted for that room.
 * Only rooms present in `persisted` (or draft) are considered; callers should
 * pass a complete map for all pricing rooms.
 */
export function mergeEffectivePrices(
  persisted: RoomPriceMap,
  draft: RoomPriceMap
): RoomPriceMap {
  const out: RoomPriceMap = { ...persisted };
  for (const [roomId, cents] of Object.entries(draft)) {
    out[roomId] = cents;
  }
  return out;
}

/**
 * Group rooms by matching current (effective) price.
 * Groups sorted highest → lowest; rooms within a group use natural order.
 */
export function groupRoomsByPrice(prices: RoomPriceMap): PriceGroup[] {
  const byPrice = new Map<number, string[]>();
  for (const roomId of sortRoomIds(Object.keys(prices))) {
    const cents = prices[roomId];
    if (typeof cents !== 'number' || !Number.isFinite(cents)) continue;
    const list = byPrice.get(cents) ?? [];
    list.push(roomId);
    byPrice.set(cents, list);
  }
  return [...byPrice.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([priceCents, roomIds]) => ({ priceCents, roomIds }));
}

/**
 * Apply a group price change: every room currently at `fromCents` (in effective
 * prices) gets `toCents` in the returned draft map. Existing draft entries for
 * other rooms are preserved. Rooms already overridden away from `fromCents` are
 * not included in the group.
 */
export function applyGroupPriceDraft(
  persisted: RoomPriceMap,
  draft: RoomPriceMap,
  fromCents: number,
  toCents: number
): RoomPriceMap {
  const effective = mergeEffectivePrices(persisted, draft);
  const next: RoomPriceMap = { ...draft };
  for (const [roomId, cents] of Object.entries(effective)) {
    if (cents !== fromCents) continue;
    if (toCents === (persisted[roomId] ?? cents)) {
      delete next[roomId];
    } else {
      next[roomId] = toCents;
    }
  }
  return next;
}

/**
 * Set one room's draft price. If it matches persisted, remove the draft entry.
 * Individual override always wins for that room over prior group drafts.
 */
export function applyRoomPriceDraft(
  persisted: RoomPriceMap,
  draft: RoomPriceMap,
  roomId: string,
  toCents: number
): RoomPriceMap {
  const next: RoomPriceMap = { ...draft };
  const persistedCents = persisted[roomId];
  if (persistedCents !== undefined && toCents === persistedCents) {
    delete next[roomId];
  } else {
    next[roomId] = toCents;
  }
  return next;
}

/** Pending changes vs persisted (draft keys only where values differ). */
export function listPendingChanges(
  persisted: RoomPriceMap,
  draft: RoomPriceMap
): PendingPriceChange[] {
  const changes: PendingPriceChange[] = [];
  for (const roomId of sortRoomIds(Object.keys(draft))) {
    const toCents = draft[roomId];
    const fromCents = persisted[roomId];
    if (typeof toCents !== 'number' || typeof fromCents !== 'number') continue;
    if (toCents === fromCents) continue;
    changes.push({ roomId, fromCents, toCents });
  }
  return changes;
}

export function hasPendingChanges(persisted: RoomPriceMap, draft: RoomPriceMap): boolean {
  return listPendingChanges(persisted, draft).length > 0;
}

export type ParsePriceResult =
  | { ok: true; cents: number }
  | { ok: false; reason: 'blank' | 'not_numeric' | 'not_positive' | 'too_many_decimals' };

/**
 * Validate admin price input.
 * - non-blank
 * - numeric
 * - > 0
 * - at most 2 decimal places (checked on the raw string when possible)
 */
export function parsePriceInput(raw: string): ParsePriceResult {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: false, reason: 'blank' };

  // Allow optional leading $ and commas as thousands separators for convenience.
  const normalized = trimmed.replace(/^\$/, '').replace(/,/g, '');
  if (normalized === '' || !/^-?\d+(\.\d+)?$/.test(normalized)) {
    return { ok: false, reason: 'not_numeric' };
  }

  const decimalPart = normalized.includes('.') ? normalized.split('.')[1] : '';
  if (decimalPart.length > 2) {
    return { ok: false, reason: 'too_many_decimals' };
  }

  const dollars = Number(normalized);
  if (!Number.isFinite(dollars)) return { ok: false, reason: 'not_numeric' };
  if (dollars <= 0) return { ok: false, reason: 'not_positive' };

  return { ok: true, cents: dollarsToCents(dollars) };
}

/** Build a complete price map for all pricing rooms, filling gaps from `defaults`. */
export function completePriceMap(
  stored: RoomPriceMap,
  defaults: RoomPriceMap
): RoomPriceMap {
  const out: RoomPriceMap = {};
  for (const roomId of PRICING_ROOM_IDS) {
    const key = String(roomId);
    const cents = stored[key] ?? defaults[key];
    if (typeof cents === 'number' && Number.isFinite(cents)) {
      out[key] = cents;
    }
  }
  return out;
}
