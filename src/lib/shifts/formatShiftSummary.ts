import { DateTime } from 'luxon';
import { SHIFT_DEFINITIONS, SHIFT_TIMEZONE, type ShiftId } from './definitions';
import type { ShiftSummary } from './types';

/** Human-readable block for Admin UI / future management messages. */
export function formatShiftSummary(summary: ShiftSummary, locale = 'en-US'): string {
  const def = SHIFT_DEFINITIONS[summary.shift];
  const dateLabel = DateTime.fromISO(summary.businessDate, { zone: SHIFT_TIMEZONE }).toFormat(
    'MMMM d, yyyy'
  );
  const startLabel = formatClock(summary.shiftStart);
  const endLabel = formatClock(summary.shiftEnd);
  const revenue = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(summary.totalRevenue);

  return [
    `${def.labelEn} Shift`,
    dateLabel,
    `${startLabel} – ${endLabel}`,
    '',
    `Revenue: ${revenue}`,
    `Cars: ${summary.totalCars}`,
    `Rooms Turned Over: ${summary.roomsTurnedOver}`,
  ].join('\n');
}

export function shiftDisplayLabel(shift: ShiftId): string {
  return SHIFT_DEFINITIONS[shift].timeRangeLabelEn;
}

function formatClock(d: Date): string {
  return DateTime.fromJSDate(d, { zone: SHIFT_TIMEZONE }).toFormat('h:mm a');
}
