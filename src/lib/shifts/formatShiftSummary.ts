import { DateTime } from 'luxon';
import {
  getShiftDisplayLabel,
  getShiftDisplayTitle,
  SHIFT_TIMEZONE,
  type ShiftId,
} from './definitions';
import type { ShiftSummary } from './types';

/**
 * Human-readable block for Admin / future Photon / management messages.
 * Uses operating-hours labels — not "Day Shift" / "Overnight Shift".
 *
 * @example
 * 8:00 AM – 4:00 PM Shift
 * August 23, 2026
 *
 * Revenue: $2,180
 * Cars: 14
 * Rooms Turned Over: 9
 */
export function formatShiftSummary(summary: ShiftSummary, locale = 'en-US'): string {
  const dateLabel = DateTime.fromISO(summary.businessDate, { zone: SHIFT_TIMEZONE }).toFormat(
    'MMMM d, yyyy'
  );
  const revenue = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(summary.totalRevenue);

  return [
    getShiftDisplayTitle(summary.shift),
    dateLabel,
    '',
    `Revenue: ${revenue}`,
    `Cars: ${summary.totalCars}`,
    `Rooms Turned Over: ${summary.roomsTurnedOver}`,
  ].join('\n');
}

/** @deprecated Prefer {@link getShiftDisplayLabel} */
export function shiftDisplayLabel(shift: ShiftId): string {
  return getShiftDisplayLabel(shift);
}

export { getShiftDisplayLabel, getShiftDisplayTitle };
