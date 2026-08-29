/**
 * View Check-ins date-range validation and calendar helpers (America/Puerto_Rico business dates).
 * Pure / testable — no Firestore.
 */

import { DateTime } from 'luxon';

export const VIEW_CHECKINS_TIMEZONE = 'America/Puerto_Rico';

/** Inclusive max calendar dates allowed in one filter (start..end). */
export const VIEW_CHECKINS_MAX_RANGE_DAYS = 7;

export type ViewCheckinsDateRangeErrorCode =
  | 'invalid_format'
  | 'end_before_start'
  | 'range_exceeds_max'
  | 'future_date';

export type ViewCheckinsDateRangeValidation =
  | { ok: true; startISO: string; endISO: string; dayCount: number }
  | { ok: false; code: ViewCheckinsDateRangeErrorCode };

function isIsoDate(value: string | undefined | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

/** Inclusive count of calendar dates from start through end (PR zone). */
export function inclusiveCalendarDayCount(startISO: string, endISO: string): number | null {
  const start = DateTime.fromISO(startISO, { zone: VIEW_CHECKINS_TIMEZONE }).startOf('day');
  const end = DateTime.fromISO(endISO, { zone: VIEW_CHECKINS_TIMEZONE }).startOf('day');
  if (!start.isValid || !end.isValid) return null;
  return Math.floor(end.diff(start, 'days').days) + 1;
}

/**
 * Validate a View Check-ins start/end pair against today's Puerto Rico calendar date.
 * Does not mutate or "fix" dates.
 */
export function validateViewCheckinsDateRange(
  startISO: string | undefined | null,
  endISO: string | undefined | null,
  todayISO: string
): ViewCheckinsDateRangeValidation {
  if (!isIsoDate(startISO) || !isIsoDate(endISO) || !isIsoDate(todayISO)) {
    return { ok: false, code: 'invalid_format' };
  }

  const start = DateTime.fromISO(startISO, { zone: VIEW_CHECKINS_TIMEZONE }).startOf('day');
  const end = DateTime.fromISO(endISO, { zone: VIEW_CHECKINS_TIMEZONE }).startOf('day');
  const today = DateTime.fromISO(todayISO, { zone: VIEW_CHECKINS_TIMEZONE }).startOf('day');
  if (!start.isValid || !end.isValid || !today.isValid) {
    return { ok: false, code: 'invalid_format' };
  }

  if (start > today || end > today) {
    return { ok: false, code: 'future_date' };
  }

  if (end < start) {
    return { ok: false, code: 'end_before_start' };
  }

  const dayCount = inclusiveCalendarDayCount(startISO, endISO);
  if (dayCount == null) {
    return { ok: false, code: 'invalid_format' };
  }
  if (dayCount > VIEW_CHECKINS_MAX_RANGE_DAYS) {
    return { ok: false, code: 'range_exceeds_max' };
  }

  return { ok: true, startISO, endISO, dayCount };
}

/** Inclusive list of YYYY-MM-DD business dates from start through end (ascending). */
export function enumerateInclusiveBusinessDates(startISO: string, endISO: string): string[] {
  const start = DateTime.fromISO(startISO, { zone: VIEW_CHECKINS_TIMEZONE }).startOf('day');
  const end = DateTime.fromISO(endISO, { zone: VIEW_CHECKINS_TIMEZONE }).startOf('day');
  if (!start.isValid || !end.isValid || end < start) return [];

  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    const iso = cursor.toISODate();
    if (iso) dates.push(iso);
    cursor = cursor.plus({ days: 1 });
  }
  return dates;
}

export function viewCheckinsDateRangeErrorTranslationKey(
  code: ViewCheckinsDateRangeErrorCode
):
  | 'list_date_range_invalid'
  | 'list_date_range_end_before_start'
  | 'list_date_range_exceeds_max'
  | 'list_date_range_future' {
  switch (code) {
    case 'end_before_start':
      return 'list_date_range_end_before_start';
    case 'range_exceeds_max':
      return 'list_date_range_exceeds_max';
    case 'future_date':
      return 'list_date_range_future';
    default:
      return 'list_date_range_invalid';
  }
}
