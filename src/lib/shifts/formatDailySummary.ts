import { DateTime } from 'luxon';
import { SHIFT_TIMEZONE } from './definitions';
import type { DailySummary, IncompleteDailySummary } from './dailyTypes';
import { formatMissingShiftSummariesError } from './calculateDailySummary';

export function formatDailySummary(summary: DailySummary, locale = 'en-US'): string {
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
    `Daily Summary — ${dateLabel}`,
    '',
    `Revenue: ${revenue}`,
    `Cars: ${summary.totalCars}`,
    `Rooms Turned Over: ${summary.roomsTurnedOver}`,
  ].join('\n');
}

export function formatIncompleteDailySummary(result: IncompleteDailySummary): string {
  return formatMissingShiftSummariesError(result.businessDate, result.missingShifts);
}
