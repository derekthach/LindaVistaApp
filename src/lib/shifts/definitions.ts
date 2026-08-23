import { DateTime } from 'luxon';
import { MOTEL_TIMEZONE } from '@/lib/dates/motelBusinessWeek';

/** Fixed motel shifts — single source of truth (America/Puerto_Rico wall clock). */
export const SHIFT_TIMEZONE = MOTEL_TIMEZONE;

export type ShiftId = 'overnight' | 'day' | 'evening';

export const SHIFT_IDS: readonly ShiftId[] = ['overnight', 'day', 'evening'] as const;

/**
 * Half-open local-minute ranges on the business date: start inclusive, end exclusive.
 * Evening's exclusive end is midnight of the next calendar day (1440 on the business date timeline).
 */
export type ShiftDefinition = {
  id: ShiftId;
  /** Minutes since midnight of the business date (inclusive). */
  startMinutes: number;
  /**
   * Minutes since midnight of the business date (exclusive).
   * Evening uses 1440 (= next day 00:00), not 0.
   */
  endMinutes: number;
  labelEn: string;
  timeRangeLabelEn: string;
};

export const SHIFT_DEFINITIONS: Record<ShiftId, ShiftDefinition> = {
  overnight: {
    id: 'overnight',
    startMinutes: 0,
    endMinutes: 8 * 60,
    labelEn: 'Overnight',
    timeRangeLabelEn: '12 AM – 8 AM',
  },
  day: {
    id: 'day',
    startMinutes: 8 * 60,
    endMinutes: 16 * 60,
    labelEn: 'Day',
    timeRangeLabelEn: '8 AM – 4 PM',
  },
  evening: {
    id: 'evening',
    startMinutes: 16 * 60,
    endMinutes: 24 * 60,
    labelEn: 'Evening',
    timeRangeLabelEn: '4 PM – 12 AM',
  },
};

export type ShiftWindow = {
  businessDate: string;
  shift: ShiftId;
  /** Inclusive start (JS Date, absolute instant). */
  shiftStart: Date;
  /** Exclusive end (JS Date, absolute instant). */
  shiftEnd: Date;
  timezone: typeof SHIFT_TIMEZONE;
};

/**
 * Absolute half-open window for a shift on a Puerto Rico business date (YYYY-MM-DD).
 * Evening: businessDate 16:00 → next calendar day 00:00; summary still belongs to businessDate.
 */
export function getShiftWindow(businessDate: string, shift: ShiftId): ShiftWindow {
  const def = SHIFT_DEFINITIONS[shift];
  const dayStart = DateTime.fromISO(businessDate, { zone: SHIFT_TIMEZONE }).startOf('day');
  if (!dayStart.isValid) {
    throw new Error(`Invalid businessDate: ${businessDate}`);
  }
  const shiftStart = dayStart.plus({ minutes: def.startMinutes }).toJSDate();
  const shiftEnd = dayStart.plus({ minutes: def.endMinutes }).toJSDate();
  return {
    businessDate,
    shift,
    shiftStart,
    shiftEnd,
    timezone: SHIFT_TIMEZONE,
  };
}

/** Half-open: start <= instant < end */
export function isInstantInHalfOpenRange(instant: Date, start: Date, end: Date): boolean {
  const t = instant.getTime();
  return t >= start.getTime() && t < end.getTime();
}

/**
 * Which shift owns a wall-clock time on a single business date (HH:mm or minutes).
 * Uses half-open minute ranges so boundary instants belong to exactly one shift.
 */
export function getShiftIdForLocalMinutes(minutesSinceMidnight: number): ShiftId {
  const mins = Math.max(0, Math.min(1439, Math.floor(minutesSinceMidnight)));
  if (mins < SHIFT_DEFINITIONS.overnight.endMinutes) return 'overnight';
  if (mins < SHIFT_DEFINITIONS.day.endMinutes) return 'day';
  return 'evening';
}

export function getShiftIdForTimeHHmm(timeHHmm: string): ShiftId {
  const parts = String(timeHHmm).trim().split(':');
  const h = parseInt(parts[0] ?? '', 10);
  const m = parseInt(parts[1] ?? '', 10);
  const mins =
    Number.isNaN(h) || Number.isNaN(m) ? 0 : Math.max(0, Math.min(1439, h * 60 + m));
  return getShiftIdForLocalMinutes(mins);
}

/** Full operational window for a business date: [00:00, next day 00:00). */
export function getBusinessDateWindow(businessDate: string): { start: Date; end: Date } {
  const overnight = getShiftWindow(businessDate, 'overnight');
  const evening = getShiftWindow(businessDate, 'evening');
  return { start: overnight.shiftStart, end: evening.shiftEnd };
}
