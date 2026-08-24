import { DateTime } from 'luxon';
import { getShiftDisplayLabel, SHIFT_IDS, SHIFT_TIMEZONE, type ShiftId } from './definitions';
import type { DailySummary } from './dailyTypes';
import type { ShiftSummary } from './types';

function formatUsd(amount: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatBusinessDateLabel(businessDate: string): string {
  const dt = DateTime.fromISO(businessDate, { zone: SHIFT_TIMEZONE });
  if (!dt.isValid) return businessDate;
  return dt.toFormat('MMMM d, yyyy');
}

function orderedShifts(shiftSummaries: ShiftSummary[]): ShiftSummary[] {
  const byShift = new Map<ShiftId, ShiftSummary>();
  for (const s of shiftSummaries) {
    byShift.set(s.shift, s);
  }
  return SHIFT_IDS.map((id) => byShift.get(id)).filter(Boolean) as ShiftSummary[];
}

/**
 * Pure formatter: persisted Daily + Shift Summary metrics → management iMessage text.
 * Does not recalculate revenue/cars/turnovers.
 * Human-readable shift hours only (never overnight/day/evening labels).
 */
export function formatDailyManagementMessage(
  dailySummary: DailySummary,
  shiftSummaries: ShiftSummary[],
  locale = 'en-US'
): string {
  const dateLabel = formatBusinessDateLabel(dailySummary.businessDate);
  const lines: string[] = [
    `Linda Vista — ${dateLabel}`,
    '',
    'DAILY SUMMARY',
    `Revenue: ${formatUsd(dailySummary.totalRevenue, locale)}`,
    `Cars: ${dailySummary.totalCars}`,
    `Rooms Turned Over: ${dailySummary.roomsTurnedOver}`,
  ];

  for (const shift of orderedShifts(shiftSummaries)) {
    lines.push('');
    lines.push(getShiftDisplayLabel(shift.shift));
    lines.push(
      `Revenue: ${formatUsd(shift.totalRevenue, locale)} · Cars: ${shift.totalCars} · Turnovers: ${shift.roomsTurnedOver}`
    );
  }

  return lines.join('\n');
}
