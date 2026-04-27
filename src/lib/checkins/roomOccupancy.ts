import type { CheckIn } from '@/types';
import { ROOM_OPTIONS, type RoomId } from '@/lib/checkins/rooms';

/** Room stay is open for checkout: room type and explicitly still checked in (`is_checked_out === false`). */
export function isActiveOccupiedRoom(record: CheckIn): boolean {
  if ((record.checkInType ?? 'room') !== 'room') return false;
  return record.is_checked_out === false;
}

/** Firestore/query semantics: only docs with checkInType room and isCheckedOut === false. */
export function isActiveOccupiedRoomDoc(data: Record<string, unknown>): boolean {
  if ((data.checkInType as string | undefined) !== 'room') return false;
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

/** Sort by ROOM_OPTIONS order, then unknown ids last. */
export function sortRoomsForDisplay<T extends { room_id: number | string }>(items: T[]): T[] {
  const order = new Map(ROOM_OPTIONS.map((r, i) => [String(r), i]));
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
