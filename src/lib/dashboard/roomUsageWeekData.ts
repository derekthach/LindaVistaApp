import { DateTime } from 'luxon';
import type { CheckIn, RoomUsageData } from '@/types';
import { isRoomCheckinRecord } from '@/lib/checkins/roomCheckinRecord';
import { getEntryCount } from '@/lib/checkins/entryCount';
import {
  getMotelBusinessWeekBoundsFromStartIso,
  getMotelBusinessWeekStart,
  MOTEL_TIMEZONE,
} from '@/lib/dates/motelBusinessWeek';

const ZONE = MOTEL_TIMEZONE;
const TOP_N = 10;

function isValidRoomId(roomId: CheckIn['room_id']): roomId is number | string {
  if (roomId == null || roomId === '') return false;
  if (typeof roomId === 'number' && (Number.isNaN(roomId) || roomId <= 0)) return false;
  return true;
}

/**
 * Top rooms by room check-in count for one motel business week (Fri–Thu, PR).
 * Includes admin late/past room entries; excludes deleted docs (not in list); uses latest saved room_id.
 */
export function deriveRoomUsageForWeekFromCheckins(
  checkins: CheckIn[],
  weekStartISO: string,
  zone: string = ZONE
): RoomUsageData {
  const snappedStart = getMotelBusinessWeekStart(
    DateTime.fromISO(weekStartISO, { zone }),
    zone
  ).toISODate() ?? weekStartISO;
  const { startISO, endISO } = getMotelBusinessWeekBoundsFromStartIso(snappedStart, zone);

  const byRoom = new Map<number | string, number>();
  for (const c of checkins) {
    if (c.date < startISO || c.date > endISO) continue;
    if (!isRoomCheckinRecord(c)) continue;
    const roomId = c.room_id;
    if (!isValidRoomId(roomId)) continue;
    byRoom.set(roomId, (byRoom.get(roomId) ?? 0) + getEntryCount(c));
  }

  const sorted = [...byRoom.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }))
    .slice(0, TOP_N);

  const usage_counts = sorted.map(([, count]) => count);
  const max_count = usage_counts.length > 0 ? Math.max(...usage_counts) : 0;

  return {
    room_numbers: sorted.map(([id]) => `Room ${id}`),
    usage_counts,
    week_start: startISO,
    week_end: endISO,
    max_count,
  };
}
