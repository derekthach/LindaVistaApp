import { DateTime } from 'luxon';
import {
  formatQuoteOfTheDaySection,
  getQuoteOfTheDay,
} from '@/lib/motivationalQuotes';
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

/** Singular/plural for turnover count in the management iMessage. */
export function formatTurnoverCountLabel(count: number): string {
  const n = Math.trunc(Number(count) || 0);
  return n === 1 ? '1 turnover' : `${n} turnovers`;
}

/**
 * User-facing shift header for the management iMessage (emoji + hours).
 * Internal ids overnight|day|evening stay unchanged.
 *
 * Plain text only — Photon delivery uses dm.send(string), which does not
 * render Markdown (`**bold**` would appear literally in iMessage).
 */
export function getShiftManagementMessageHeader(shift: ShiftId): string {
  const hours = getShiftDisplayLabel(shift);
  switch (shift) {
    case 'overnight':
      return `🌙 ${hours}`;
    case 'day':
      return `☀️ ${hours}`;
    case 'evening':
      return `🌆 ${hours}`;
  }
}

/**
 * Pure formatter: persisted Daily + Shift Summary metrics → management iMessage text.
 * Does not recalculate revenue/cars/turnovers.
 * Human-readable shift hours only (never overnight/day/evening labels).
 *
 * Note: Spectrum is called with a plain string (not markdown()), so this output
 * must not include Markdown markers like **bold**.
 */
export function formatDailyManagementMessage(
  dailySummary: DailySummary,
  shiftSummaries: ShiftSummary[],
  locale = 'en-US'
): string {
  const dateLabel = formatBusinessDateLabel(dailySummary.businessDate);
  const lines: string[] = [
    '🏨 Linda Vista — Daily Summary',
    `📅 ${dateLabel}`,
    '',
    `💰 Revenue: ${formatUsd(dailySummary.totalRevenue, locale)}`,
    `🚗 Cars: ${dailySummary.totalCars}`,
    `🧹 Rooms Turned Over: ${dailySummary.roomsTurnedOver}`,
    '',
    '━━━━━━━━━━━━━━',
  ];

  for (const shift of orderedShifts(shiftSummaries)) {
    lines.push('');
    lines.push(getShiftManagementMessageHeader(shift.shift));
    lines.push(`💵 ${formatUsd(shift.totalRevenue, locale)} revenue`);
    lines.push(`🚗 ${shift.totalCars} cars`);
    lines.push(`🧹 ${formatTurnoverCountLabel(shift.roomsTurnedOver)}`);
  }

  const body = lines.join('\n');

  // Quote is non-critical — never block the operational Daily Summary.
  try {
    const quote = getQuoteOfTheDay(dailySummary.businessDate);
    return `${body}\n\n${formatQuoteOfTheDaySection(quote)}`;
  } catch {
    return body;
  }
}
