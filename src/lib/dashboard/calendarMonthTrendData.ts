import { DateTime } from 'luxon';
import type { CalendarMonthRoomTrendData, CheckIn } from '@/types';
import { isRoomCheckinRecord } from '@/lib/checkins/roomCheckinRecord';
import { getEntryCount } from '@/lib/checkins/entryCount';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Daily series for the **calendar** month containing `now` (timezone `zone`).
 * Buckets by `checkin.date` (YYYY-MM-DD), consistent with weekly motel trend charts.
 * Room-only: counts use `isRoomCheckinRecord`; revenue sums `cost` for those rows only.
 */
export function deriveCalendarMonthRoomTrendFromCheckins(
  checkins: CheckIn[],
  now: DateTime,
  zone: string
): CalendarMonthRoomTrendData {
  const z = now.setZone(zone);
  const monthStart = z.startOf('month');
  const daysInMonth = monthStart.daysInMonth ?? 31;

  const byIso = new Map<string, CheckIn[]>();
  for (const c of checkins) {
    const list = byIso.get(c.date) ?? [];
    list.push(c);
    byIso.set(c.date, list);
  }

  const prevMonthStart = monthStart.minus({ months: 1 });

  const trendAxisIsos: string[] = [];
  const roomCheckins: number[] = [];
  const roomRevenue: number[] = [];
  const roomCheckinsPrevMonth: number[] = [];
  const roomRevenuePrevMonth: number[] = [];

  for (let i = 0; i < daysInMonth; i++) {
    const day = monthStart.plus({ days: i });
    const iso = day.toISODate() ?? '';
    trendAxisIsos.push(iso);

    let rooms = 0;
    let rev = 0;
    for (const c of byIso.get(iso) ?? []) {
      if (!isRoomCheckinRecord(c)) continue;
      rooms += getEntryCount(c);
      rev += Number(c.cost) || 0;
    }
    roomCheckins.push(rooms);
    roomRevenue.push(roundMoney(rev));

    const dayNum = i + 1;
    const prevPoint = prevMonthStart.set({ day: dayNum });
    let prevIso: string | null = null;
    if (prevPoint.isValid && prevPoint.month === prevMonthStart.month) {
      prevIso = prevPoint.toISODate() ?? null;
    }
    if (!prevIso) {
      roomCheckinsPrevMonth.push(0);
      roomRevenuePrevMonth.push(0);
      continue;
    }
    let roomsPrev = 0;
    let revPrev = 0;
    for (const c of byIso.get(prevIso) ?? []) {
      if (!isRoomCheckinRecord(c)) continue;
      roomsPrev += getEntryCount(c);
      revPrev += Number(c.cost) || 0;
    }
    roomCheckinsPrevMonth.push(roomsPrev);
    roomRevenuePrevMonth.push(roundMoney(revPrev));
  }

  return {
    trendAxisIsos,
    roomCheckins,
    roomRevenue,
    roomCheckinsPrevMonth,
    roomRevenuePrevMonth,
  };
}
