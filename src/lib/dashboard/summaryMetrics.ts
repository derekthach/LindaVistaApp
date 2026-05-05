import { DateTime } from 'luxon';
import type { CheckIn, SummaryMetrics } from '@/types';
import { isRoomCheckinRecord } from '@/lib/checkins/roomCheckinRecord';
import { getMotelBusinessWeekStart } from '@/lib/dates/motelBusinessWeek';

const ZONE = 'America/Puerto_Rico';

/**
 * Reportable instant for a check-in: business `date` + `time` in PR (matches Firestore checkInAt normalization).
 */
export function getCheckinAtInZone(c: CheckIn, zone: string): DateTime {
  const d = (c.date || '').trim();
  if (!d) {
    return DateTime.invalid('missing date');
  }
  let tm = (c.time || '00:00').trim();
  const m = tm.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    tm = `${m[1].padStart(2, '0')}:${m[2]}`;
  } else {
    tm = '00:00';
  }
  let dt = DateTime.fromFormat(`${d} ${tm}`, 'yyyy-MM-dd HH:mm', { zone });
  if (!dt.isValid) {
    dt = DateTime.fromISO(d, { zone }).startOf('day');
  }
  return dt;
}

function isCheckinInWindow(c: CheckIn, zone: string, start: DateTime, end: DateTime): boolean {
  const t = getCheckinAtInZone(c, zone);
  if (!t.isValid) return false;
  return +t >= +start && +t <= +end;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Weekly totals for `[motel week Friday 00:00, now]` vs prior week's same elapsed span.
 * Deltas are current − prior (signed); never percentages.
 */
export function computeWeeklySamePointTotals(
  checkins: CheckIn[],
  now: DateTime,
  zone: string = ZONE
): {
  carsThisWeek: number;
  profitThisWeek: number;
  weekCarsDeltaVsPrior: number;
  weekRevenueDeltaVsPrior: number;
} {
  const weekStart = getMotelBusinessWeekStart(now, zone);
  const prevWeekStart = weekStart.minus({ days: 7 });
  const prevEnd = prevWeekStart.plus(now.diff(weekStart));

  let carsCur = 0;
  let revCur = 0;
  let carsPrev = 0;
  let revPrev = 0;

  for (const c of checkins) {
    if (isCheckinInWindow(c, zone, weekStart, now)) {
      revCur += c.cost;
      if (isRoomCheckinRecord(c)) carsCur += 1;
    }
    if (isCheckinInWindow(c, zone, prevWeekStart, prevEnd)) {
      revPrev += c.cost;
      if (isRoomCheckinRecord(c)) carsPrev += 1;
    }
  }

  revCur = roundMoney(revCur);
  revPrev = roundMoney(revPrev);

  return {
    carsThisWeek: carsCur,
    profitThisWeek: revCur,
    weekCarsDeltaVsPrior: carsCur - carsPrev,
    weekRevenueDeltaVsPrior: roundMoney(revCur - revPrev),
  };
}

/**
 * Today midnight → now vs yesterday midnight → same elapsed instant (PR).
 * Headline today counts/revenue use the same windows as the deltas.
 */
export function computeTodaySamePointTotals(
  checkins: CheckIn[],
  now: DateTime,
  zone: string = ZONE
): {
  carsToday: number;
  profitToday: number;
  todayCarsDeltaVsYesterday: number;
  todayRevenueDeltaVsYesterday: number;
} {
  const z = now.setZone(zone);
  const todayStart = z.startOf('day');
  const yesterdayStart = todayStart.minus({ days: 1 });
  const yesterdayEnd = yesterdayStart.plus(z.diff(todayStart));

  let carsToday = 0;
  let revToday = 0;
  let carsYest = 0;
  let revYest = 0;

  for (const c of checkins) {
    if (isCheckinInWindow(c, zone, todayStart, z)) {
      revToday += c.cost;
      if (isRoomCheckinRecord(c)) carsToday += 1;
    }
    if (isCheckinInWindow(c, zone, yesterdayStart, yesterdayEnd)) {
      revYest += c.cost;
      if (isRoomCheckinRecord(c)) carsYest += 1;
    }
  }

  revToday = roundMoney(revToday);
  revYest = roundMoney(revYest);

  return {
    carsToday,
    profitToday: revToday,
    todayCarsDeltaVsYesterday: carsToday - carsYest,
    todayRevenueDeltaVsYesterday: roundMoney(revToday - revYest),
  };
}

/** Dashboard summary metrics derived from in-memory check-ins (dashboard bundle path). */
export function deriveSummaryMetricsFromCheckins(checkins: CheckIn[], now: DateTime): SummaryMetrics {
  const zone = ZONE;

  const today = computeTodaySamePointTotals(checkins, now, zone);
  const weekly = computeWeeklySamePointTotals(checkins, now, zone);

  return {
    carsToday: today.carsToday,
    profitToday: today.profitToday,
    todayCarsDeltaVsYesterday: today.todayCarsDeltaVsYesterday,
    todayRevenueDeltaVsYesterday: today.todayRevenueDeltaVsYesterday,
    carsThisWeek: weekly.carsThisWeek,
    profitThisWeek: weekly.profitThisWeek,
    weekCarsDeltaVsPrior: weekly.weekCarsDeltaVsPrior,
    weekRevenueDeltaVsPrior: weekly.weekRevenueDeltaVsPrior,
  };
}
