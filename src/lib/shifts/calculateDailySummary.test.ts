import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import {
  calculateDailySummary,
  formatMissingShiftSummariesError,
  isCompleteDailySummary,
  type ShiftSummary,
} from '@/lib/shifts';
import { buildSectionedData, type SectionTotals } from '@/lib/checkins/sectioning';
import type { CheckIn } from '@/types';

const ZONE = 'America/Puerto_Rico';
const BUSINESS_DATE = '2026-08-23';

function emptySections(): {
  checkinCount: number;
  viewCheckinsSections: [SectionTotals, SectionTotals, SectionTotals];
  viewCheckinsDayTotals: SectionTotals;
} {
  const z = { roomCents: 0, foodCents: 0, beerCents: 0, totalCents: 0, carCount: 0 };
  return {
    checkinCount: 0,
    viewCheckinsSections: [{ ...z }, { ...z }, { ...z }],
    viewCheckinsDayTotals: { ...z },
  };
}

function shiftSummary(
  shift: ShiftSummary['shift'],
  over: Partial<ShiftSummary> = {}
): ShiftSummary {
  const startMins = shift === 'overnight' ? 0 : shift === 'day' ? 8 * 60 : 16 * 60;
  const endMins = shift === 'overnight' ? 8 * 60 : shift === 'day' ? 16 * 60 : 24 * 60;
  const dayStart = DateTime.fromISO(BUSINESS_DATE, { zone: ZONE }).startOf('day');
  const roomCents = over.roomCents ?? Math.round((over.totalRevenue ?? 0) * 100);
  return {
    businessDate: BUSINESS_DATE,
    shift,
    shiftStart: dayStart.plus({ minutes: startMins }).toJSDate(),
    shiftEnd: dayStart.plus({ minutes: endMins }).toJSDate(),
    totalRevenue: over.totalRevenue ?? roomCents / 100,
    roomCents,
    foodCents: over.foodCents ?? 0,
    beerCents: over.beerCents ?? 0,
    totalCars: 0,
    roomsTurnedOver: 0,
    timezone: ZONE,
    ...over,
  };
}

describe('calculateDailySummary', () => {
  it('sums complete overnight + day + evening metrics including type cents', () => {
    const result = calculateDailySummary(
      [
        shiftSummary('overnight', {
          totalRevenue: 1320,
          roomCents: 132000,
          totalCars: 8,
          roomsTurnedOver: 5,
        }),
        shiftSummary('day', {
          totalRevenue: 2180,
          roomCents: 200000,
          foodCents: 18000,
          totalCars: 14,
          roomsTurnedOver: 9,
        }),
        shiftSummary('evening', {
          totalRevenue: 2750,
          roomCents: 270000,
          beerCents: 5000,
          totalCars: 17,
          roomsTurnedOver: 11,
        }),
      ],
      emptySections()
    );
    expect(isCompleteDailySummary(result)).toBe(true);
    if (!isCompleteDailySummary(result)) return;
    expect(result.businessDate).toBe(BUSINESS_DATE);
    expect(result.totalRevenue).toBe(6250);
    expect(result.roomCents).toBe(602000);
    expect(result.foodCents).toBe(18000);
    expect(result.beerCents).toBe(5000);
    expect(result.totalCars).toBe(39);
    expect(result.roomsTurnedOver).toBe(25);
    expect(result.timezone).toBe(ZONE);
    expect(result.shiftSummaryIds).toEqual({
      overnight: '2026-08-23_overnight',
      day: '2026-08-23_day',
      evening: '2026-08-23_evening',
    });
  });

  it('attaches View Check-ins section breakdown from buildSectionedData', () => {
    const checkins: CheckIn[] = [
      {
        receipt_number: '1',
        date: BUSINESS_DATE,
        time: '02:00',
        checkInType: 'room',
        room_id: 1,
        cost: 50,
        payment_method: 'cash',
        staff_name: 'A',
        car_plate: '',
        car_make: '',
        car_color: 'black',
      },
      {
        receipt_number: '2',
        date: BUSINESS_DATE,
        time: '10:00',
        checkInType: 'food',
        room_id: 0,
        cost: 12.5,
        payment_method: 'cash',
        staff_name: 'A',
        car_plate: '',
        car_make: '',
        car_color: 'black',
      },
    ];
    const sectioned = buildSectionedData(checkins);
    const result = calculateDailySummary(
      [
        shiftSummary('overnight', { roomCents: 5000, totalRevenue: 50, totalCars: 1 }),
        shiftSummary('day', { foodCents: 1250, totalRevenue: 12.5, totalCars: 0 }),
        shiftSummary('evening', { totalRevenue: 0, totalCars: 0 }),
      ],
      {
        checkinCount: checkins.length,
        viewCheckinsSections: [
          sectioned.sectionTotals[0]!,
          sectioned.sectionTotals[1]!,
          sectioned.sectionTotals[2]!,
        ],
        viewCheckinsDayTotals: sectioned.dayTotals,
      }
    );
    expect(isCompleteDailySummary(result)).toBe(true);
    if (!isCompleteDailySummary(result)) return;
    expect(result.checkinCount).toBe(2);
    expect(result.viewCheckinsDayTotals).toEqual(sectioned.dayTotals);
    expect(result.viewCheckinsDayTotals.totalCents).toBe(6250);
  });

  it('treats a zero-activity shift as valid when the summary exists', () => {
    const result = calculateDailySummary(
      [
        shiftSummary('overnight', { totalRevenue: 0, totalCars: 0, roomsTurnedOver: 0 }),
        shiftSummary('day', {
          totalRevenue: 500,
          roomCents: 50000,
          totalCars: 10,
          roomsTurnedOver: 4,
        }),
        shiftSummary('evening', {
          totalRevenue: 100,
          roomCents: 10000,
          totalCars: 2,
          roomsTurnedOver: 1,
        }),
      ],
      emptySections()
    );
    expect(isCompleteDailySummary(result)).toBe(true);
    if (!isCompleteDailySummary(result)) return;
    expect(result.totalRevenue).toBe(600);
    expect(result.totalCars).toBe(12);
    expect(result.roomsTurnedOver).toBe(5);
  });

  it('does not silently complete when evening is missing', () => {
    const result = calculateDailySummary(
      [
        shiftSummary('overnight', { totalRevenue: 100, roomCents: 10000, totalCars: 1, roomsTurnedOver: 1 }),
        shiftSummary('day', { totalRevenue: 200, roomCents: 20000, totalCars: 2, roomsTurnedOver: 2 }),
      ],
      emptySections()
    );
    expect(result.status).toBe('incomplete');
    if (result.status !== 'incomplete') return;
    expect(result.missingShifts).toEqual(['evening']);
    expect(result.businessDate).toBe(BUSINESS_DATE);
    expect('totalRevenue' in result).toBe(false);
  });

  it('does not treat missing shifts as zero revenue', () => {
    const result = calculateDailySummary(
      [shiftSummary('day', { totalRevenue: 999, roomCents: 99900, totalCars: 9 })],
      emptySections()
    );
    expect(result.status).toBe('incomplete');
  });
});

describe('formatMissingShiftSummariesError', () => {
  it('names missing shifts with operating-hours labels', () => {
    expect(formatMissingShiftSummariesError(BUSINESS_DATE, ['evening'])).toContain('4:00 PM');
  });
});
