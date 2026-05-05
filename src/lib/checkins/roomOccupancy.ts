import type { CheckIn } from '@/types';
import { FULL_ROOM_CATALOG, roomOptionsForEmployeeEdit, type RoomId } from '@/lib/checkins/rooms';

/**
 * Normalize room id for occupancy grouping (e.g. "40", "14A", "14b" → same logical key).
 * Trims whitespace and uppercases so "14a" / "14A" collapse to one bucket.
 * (Shared with checkout dedupe and employee room correction.)
 */
export function normalizeOccupiedRoomKey(roomId: unknown): string {
  if (roomId == null || roomId === '') return '';
  return String(roomId).trim().toUpperCase().replace(/\s+/g, '');
}

/** Room stay is open for checkout: room type and explicitly still checked in (`is_checked_out === false`). */
export function isActiveOccupiedRoom(record: CheckIn): boolean {
  if ((record.checkInType ?? 'room') !== 'room') return false;
  return record.is_checked_out === false;
}

/** Firestore/query semantics: only docs with checkInType room and isCheckedOut === false. */
export function isActiveOccupiedRoomDoc(data: Record<string, unknown>): boolean {
  if ((data.checkInType as string | undefined) !== 'room') return false;
  if (data.isPastEntry === true) return false;
  return data.isCheckedOut === false;
}

/**
 * Employee recent-receipt room correction is blocked once checkout and cleaning are recorded.
 * Cleaning is inferred from `cleanedBy` or `cleanedAt` (not checkout alone), so stays remain
 * editable if the doc were ever split into "checked out" without a cleaning marker.
 */
export function isEmployeeRoomNumberLockedForCompletedStay(record: CheckIn): boolean {
  if ((record.checkInType ?? 'room') !== 'room') return false;
  if (record.is_checked_out !== true) return false;
  const cleanedBy = (record.cleaned_by ?? '').trim();
  const cleanedAt = (record.cleaned_at ?? '').trim();
  return cleanedBy.length > 0 || cleanedAt.length > 0;
}

function hasFirestoreCleanedTimestamp(cleanedAt: unknown): boolean {
  if (cleanedAt == null) return false;
  if (typeof cleanedAt === 'object' && cleanedAt !== null && 'toMillis' in cleanedAt) {
    const ms = (cleanedAt as { toMillis?: () => number }).toMillis?.();
    return typeof ms === 'number' && !Number.isNaN(ms);
  }
  return false;
}

/** Same rule as {@link isEmployeeRoomNumberLockedForCompletedStay} for raw Firestore check-in docs. */
export function isEmployeeRoomNumberLockedForCompletedStayDoc(data: Record<string, unknown>): boolean {
  const type = (data.checkInType as string | undefined) ?? 'room';
  if (type !== 'room') return false;
  if (data.isCheckedOut !== true) return false;
  const cleanedBy = typeof data.cleanedBy === 'string' ? data.cleanedBy.trim() : '';
  if (cleanedBy.length > 0) return true;
  return hasFirestoreCleanedTimestamp(data.cleanedAt);
}

/** Sort by full catalog order, then unknown ids last. */
export function sortRoomsForDisplay<T extends { room_id: number | string }>(items: T[]): T[] {
  const order = new Map(FULL_ROOM_CATALOG.map((r, i) => [String(r), i]));
  return [...items].sort((a, b) => {
    const ia = order.get(String(a.room_id)) ?? 10000;
    const ib = order.get(String(b.room_id)) ?? 10000;
    if (ia !== ib) return ia - ib;
    return String(a.room_id).localeCompare(String(b.room_id), undefined, { numeric: true });
  });
}

export function getOccupiedRoomIdsFromCheckins(checkins: CheckIn[]): Set<string> {
  const set = new Set<string>();
  for (const c of checkins) {
    if (isActiveOccupiedRoom(c)) {
      set.add(String(c.room_id));
    }
  }
  return set;
}

/** Selectable rooms excluding those with an active (unchecked-out) stay. */
export function getAvailableRoomOptions(
  allRoomOptions: readonly RoomId[],
  occupiedRoomIds: ReadonlySet<string>
): RoomId[] {
  return allRoomOptions.filter((r) => !occupiedRoomIds.has(String(r)));
}

/**
 * Normalized room keys for active stays **other than** the check-in being edited
 * (same source as Checkout Rooms: `listActiveOccupiedRoomCheckins`).
 */
export function occupiedRoomKeysFromOtherActiveStays(
  activeStays: CheckIn[],
  editingCheckinId: string | undefined
): Set<string> {
  const set = new Set<string>();
  for (const c of activeStays) {
    if (!c.id || c.id === editingCheckinId) continue;
    const k = normalizeOccupiedRoomKey(c.room_id);
    if (k) set.add(k);
  }
  return set;
}

/**
 * Employee Recent Receipts room dropdown: catalog + legacy head from
 * {@link roomOptionsForEmployeeEdit}, minus rooms held by **other** active stays,
 * but always keeping the receipt’s current room selectable.
 */
export function roomOptionsForEmployeeRecentEdit(
  currentRoomId: unknown,
  keysOccupiedByOtherActiveStays: ReadonlySet<string>
): RoomId[] {
  const options = roomOptionsForEmployeeEdit(currentRoomId);
  const curKey = normalizeOccupiedRoomKey(currentRoomId);
  return options.filter((r) => {
    const rk = normalizeOccupiedRoomKey(r);
    if (!keysOccupiedByOtherActiveStays.has(rk)) return true;
    return curKey !== '' && rk === curKey;
  });
}

/**
 * Whether `targetRoomId` is allowed for an employee correction: same as current room on the doc,
 * or not claimed by any other active occupied stay.
 */
export function isTargetRoomAvailableForEmployeeCorrection(
  activeStays: CheckIn[],
  editingCheckinId: string,
  targetRoomId: number | string,
  currentRoomIdOnEditingDoc: number | string
): boolean {
  const tk = normalizeOccupiedRoomKey(targetRoomId);
  const curKey = normalizeOccupiedRoomKey(currentRoomIdOnEditingDoc);
  if (!tk) return false;
  if (tk === curKey) return true;
  for (const c of activeStays) {
    if (c.id === editingCheckinId) continue;
    if (normalizeOccupiedRoomKey(c.room_id) === tk) return false;
  }
  return true;
}
