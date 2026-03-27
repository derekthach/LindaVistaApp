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
