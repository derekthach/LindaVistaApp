import { DateTime } from 'luxon';

/** Puerto Rico — all motel business-week boundaries use this zone. */
export const MOTEL_TIMEZONE = 'America/Puerto_Rico';

export type MotelBusinessWeekRange = {
  /** Friday 12:00:00.000 a.m. (start of day) in `zone` */
  start: DateTime;
  /** Thursday 11:59:59.999 p.m. (end of day) of the same motel week */
  end: DateTime;
};

/**
 * Start of the current motel business week: the most recent Friday at 00:00:00.000 in `zone`.
 * Week runs Fri 12:00 a.m. → Thu 11:59:59.999 (Puerto Rico).
 */
export function getMotelBusinessWeekStart(now: DateTime, zone: string = MOTEL_TIMEZONE): DateTime {
  const z = now.setZone(zone).startOf('day');
  const weekday = z.weekday; // ISO: Mon=1 … Sun=7, Fri=5
  const daysSinceFriday = (weekday - 5 + 7) % 7;
  return z.minus({ days: daysSinceFriday });
}

/**
 * Full motel week containing `now`: Fri 12:00 a.m. through the following Thu 11:59:59.999 (inclusive).
 */
export function getMotelBusinessWeekRange(
  now: DateTime,
  zone: string = MOTEL_TIMEZONE
): MotelBusinessWeekRange {
  const start = getMotelBusinessWeekStart(now, zone);
  const end = start.plus({ days: 6 }).endOf('day');
  return { start, end };
}

/**
 * The motel week immediately before the one containing `now` (prior Fri — prior Thu).
 */
export function getPreviousMotelBusinessWeekRange(
  now: DateTime,
  zone: string = MOTEL_TIMEZONE
): MotelBusinessWeekRange {
  const currentStart = getMotelBusinessWeekStart(now, zone);
  const prevStart = currentStart.minus({ days: 7 }).startOf('day');
  const prevEnd = currentStart.minus({ days: 1 }).endOf('day');
  return { start: prevStart, end: prevEnd };
}

/**
 * ISO calendar date (YYYY-MM-DD) for the first day of the current motel week (always a Friday in PR).
 */
export function getMotelBusinessWeekStartIso(
  now: DateTime,
  zone: string = MOTEL_TIMEZONE
): string {
  return getMotelBusinessWeekStart(now, zone).toISODate() ?? '';
}
