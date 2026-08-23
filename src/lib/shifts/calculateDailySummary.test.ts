import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import {
  calculateDailySummary,
  formatMissingShiftSummariesError,
  isCompleteDailySummary,
  type ShiftSummary,
} from '@/lib/shifts';

const ZONE = 'America/Puerto_Rico';
const BUSINESS_DATE = '2026-08-23';

function shiftSummary(
  shift: ShiftSummary['shift'],
  over: Partial<ShiftSummary> = {}
): ShiftSummary {
  const startMins = shift === 'overnight' ? 0 : shift === 'day' ? 8 * 60 : 16 * 60;
  const endMins = shift === 'overnight' ? 8 * 60 : shift === 'day' ? 16 * 60 : 24 * 60;
  const dayStart = DateTime.fromISO(BUSINESS_DATE, { zone: ZONE }).startOf('day');
  return {
    businessDate: BUSINESS_DATE,
    shift,
    shiftStart: dayStart.plus({ minutes: startMins }).toJSDate(),
    shiftEnd: dayStart.plus({ minutes: endMins }).toJSDate(),
    totalRevenue: 0,
    totalCars: 0,
    roomsTurnedOver: 0,
    timezone: ZONE,
    ...over,
  };
}

describe('calculateDailySummary', () => {
  it('sums complete overnight + day + evening metrics', () => {
    const result = calculateDailySummary([
      shiftSummary('overnight', { totalRevenue: 1320, totalCars: 8, roomsTurnedOver: 5 }),
      shiftSummary('day', { totalRevenue: 2180, totalCars: 14, roomsTurnedOver: 9 }),
      shiftSummary('evening', { totalRevenue: 2750, totalCars: 17, roomsTurnedOver: 11 }),
    ]);
    expect(isCompleteDailySummary(result)).toBe(true);
    if (!isCompleteDailySummary(result)) return;
    expect(result.businessDate).toBe(BUSINESS_DATE);
    expect(result.totalRevenue).toBe(6250);
    expect(result.totalCars).toBe(39);
    expect(result.roomsTurnedOver).toBe(25);
    expect(result.timezone).toBe(ZONE);
    expect(result.shiftSummaryIds).toEqual({
      overnight: '2026-08-23_overnight',
      day: '2026-08-23_day',
      evening: '2026-08-23_evening',
    });
  });

  it('treats a zero-activity shift as valid when the summary exists', () => {
    const result = calculateDailySummary([
      shiftSummary('overnight', { totalRevenue: 0, totalCars: 0, roomsTurnedOver: 0 }),
      shiftSummary('day', { totalRevenue: 500, totalCars: 10, roomsTurnedOver: 4 }),
      shiftSummary('evening', { totalRevenue: 100, totalCars: 2, roomsTurnedOver: 1 }),
    ]);
    expect(isCompleteDailySummary(result)).toBe(true);
    if (!isCompleteDailySummary(result)) return;
    expect(result.totalRevenue).toBe(600);
    expect(result.totalCars).toBe(12);
    expect(result.roomsTurnedOver).toBe(5);
  });

  it('does not silently complete when evening is missing', () => {
    const result = calculateDailySummary([
      shiftSummary('overnight', { totalRevenue: 100, totalCars: 1, roomsTurnedOver: 1 }),
      shiftSummary('day', { totalRevenue: 200, totalCars: 2, roomsTurnedOver: 2 }),
    ]);
    expect(result.status).toBe('incomplete');
    if (result.status !== 'incomplete') return;
    expect(result.missingShifts).toEqual(['evening']);
    expect(result.businessDate).toBe(BUSINESS_DATE);
    expect('totalRevenue' in result).toBe(false);
  });

  it('does not treat missing shifts as zero revenue', () => {
    const result = calculateDailySummary([shiftSummary('day', { totalRevenue: 999, totalCars: 9 })]);
    expect(result.status).toBe('incomplete');
    if (result.status !== 'incomplete') return;
    expect(result.missingShifts).toEqual(['overnight', 'evening']);
    expect(formatMissingShiftSummariesError(result.businessDate, result.missingShifts)).toContain(
      'Overnight and Evening Shift Summaries are missing'
    );
  });

  it('keeps evening on the same businessDate even though the window ends at next midnight', () => {
    const evening = shiftSummary('evening', { totalRevenue: 50, totalCars: 1, roomsTurnedOver: 1 });
    expect(evening.businessDate).toBe(BUSINESS_DATE);
    expect(
      DateTime.fromJSDate(evening.shiftEnd, { zone: ZONE }).toISODate()
    ).toBe('2026-08-24');
    const result = calculateDailySummary([
      shiftSummary('overnight'),
      shiftSummary('day'),
      evening,
    ]);
    expect(isCompleteDailySummary(result)).toBe(true);
    if (!isCompleteDailySummary(result)) return;
    expect(result.businessDate).toBe(BUSINESS_DATE);
    expect(result.shiftSummaryIds.evening).toBe('2026-08-23_evening');
  });

  it('preserves multiple turnovers already counted across shifts (no room-number dedupe)', () => {
    const result = calculateDailySummary([
      shiftSummary('overnight', { roomsTurnedOver: 2 }),
      shiftSummary('day', { roomsTurnedOver: 2 }),
      shiftSummary('evening', { roomsTurnedOver: 1 }),
    ]);
    expect(isCompleteDailySummary(result)).toBe(true);
    if (!isCompleteDailySummary(result)) return;
    expect(result.roomsTurnedOver).toBe(5);
  });

  it('rejects mixed business dates instead of summing across days', () => {
    const result = calculateDailySummary([
      shiftSummary('overnight', { businessDate: '2026-08-23' }),
      shiftSummary('day', { businessDate: '2026-08-24' }),
      shiftSummary('evening', { businessDate: '2026-08-23' }),
    ]);
    expect(result.status).toBe('incomplete');
  });
});
