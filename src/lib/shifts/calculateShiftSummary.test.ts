import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import type { CheckIn } from '@/types';
import { totalsToCents } from '@/lib/checkins/sectioning';
import {
  calculateDayShiftSummaries,
  calculateShiftSummary,
  getShiftIdForLocalMinutes,
  getShiftIdForTimeHHmm,
  getShiftWindow,
  sumShiftMetrics,
  type RoomTurnoverRecord,
} from '@/lib/shifts';

const ZONE = 'America/Puerto_Rico';
const BUSINESS_DATE = '2026-08-23';

function room(over: Partial<CheckIn> = {}): CheckIn {
  return {
    id: over.id ?? `id-${over.receipt_number ?? '1'}`,
    receipt_number: '10001',
    date: BUSINESS_DATE,
    time: '10:00',
    checkInType: 'room',
    room_id: 12,
    cost: 100,
    payment_method: 'cash',
    staff_name: 'Test',
    car_plate: 'ABC123',
    car_make: 'Toyota',
    car_color: 'black',
    ...over,
  };
}

function atLocal(isoDate: string, h: number, m: number, s = 0, ms = 0): Date {
  return DateTime.fromObject(
    { year: Number(isoDate.slice(0, 4)), month: Number(isoDate.slice(5, 7)), day: Number(isoDate.slice(8, 10)), hour: h, minute: m, second: s, millisecond: ms },
    { zone: ZONE }
  ).toJSDate();
}

describe('shift boundary attribution (half-open)', () => {
  it('assigns boundary clock times to exactly one shift', () => {
    // 7:59:59 → overnight; 8:00:00 → day
    expect(getShiftIdForLocalMinutes(7 * 60 + 59)).toBe('overnight');
    expect(getShiftIdForTimeHHmm('07:59')).toBe('overnight');
    expect(getShiftIdForLocalMinutes(8 * 60)).toBe('day');
    expect(getShiftIdForTimeHHmm('08:00')).toBe('day');

    // 3:59 → day; 4:00 → evening
    expect(getShiftIdForLocalMinutes(15 * 60 + 59)).toBe('day');
    expect(getShiftIdForTimeHHmm('15:59')).toBe('day');
    expect(getShiftIdForLocalMinutes(16 * 60)).toBe('evening');
    expect(getShiftIdForTimeHHmm('16:00')).toBe('evening');

    // 11:59 → evening; 12:00 → overnight (next business date conceptually)
    expect(getShiftIdForLocalMinutes(23 * 60 + 59)).toBe('evening');
    expect(getShiftIdForTimeHHmm('23:59')).toBe('evening');
    expect(getShiftIdForLocalMinutes(0)).toBe('overnight');
    expect(getShiftIdForTimeHHmm('00:00')).toBe('overnight');
  });

  it('evening window belongs to businessDate even though end is next midnight', () => {
    const w = getShiftWindow(BUSINESS_DATE, 'evening');
    expect(w.businessDate).toBe(BUSINESS_DATE);
    expect(w.shiftStart.toISOString()).toBe(atLocal(BUSINESS_DATE, 16, 0).toISOString());
    expect(w.shiftEnd.toISOString()).toBe(atLocal('2026-08-24', 0, 0).toISOString());
  });
});

describe('calculateShiftSummary revenue and cars', () => {
  it('reuses Day Summary totalsToCents rules (room + food + beer, cars = room docs)', () => {
    const checkins: CheckIn[] = [
      room({ receipt_number: '1', time: '07:59', cost: 50 }),
      room({ receipt_number: '2', time: '08:00', cost: 60 }),
      room({
        receipt_number: '3',
        time: '09:00',
        checkInType: 'food',
        room_id: 0,
        cost: 20,
        car_plate: '',
      }),
      room({
        receipt_number: '4',
        time: '16:00',
        checkInType: 'beer',
        room_id: 0,
        cost: 10,
        car_plate: '',
      }),
      room({
        receipt_number: '5',
        time: '17:00',
        cost: 80,
        payment_splits: [
          { method: 'cash', amount: 40 },
          { method: 'ath_mobil', amount: 40 },
        ],
        total_collected: 80,
      }),
      room({
        receipt_number: '6',
        time: '02:00',
        cost: 35,
        is_past_entry: true,
      }),
    ];

    const overnight = calculateShiftSummary({
      businessDate: BUSINESS_DATE,
      shift: 'overnight',
      checkins,
    });
    const day = calculateShiftSummary({ businessDate: BUSINESS_DATE, shift: 'day', checkins });
    const evening = calculateShiftSummary({
      businessDate: BUSINESS_DATE,
      shift: 'evening',
      checkins,
    });

    expect(overnight.totalRevenue).toBe(85); // 50 + 35 past
    expect(overnight.totalCars).toBe(2);
    expect(day.totalRevenue).toBe(80); // 60 room + 20 food
    expect(day.totalCars).toBe(1);
    expect(evening.totalRevenue).toBe(90); // 10 beer + 80 room
    expect(evening.totalCars).toBe(1);

    const dayTotals = totalsToCents(checkins);
    const summed = sumShiftMetrics([overnight, day, evening]);
    expect(Math.round(summed.totalRevenue * 100)).toBe(dayTotals.totalCents);
    expect(summed.totalCars).toBe(dayTotals.carCount);
  });

  it('does not double-count split payments in revenue (uses cost from normalize)', () => {
    const checkins = [
      room({
        time: '10:00',
        cost: 65,
        payment_splits: [
          { method: 'cash', amount: 40 },
          { method: 'venmo', amount: 25 },
        ],
        total_collected: 65,
      }),
    ];
    const day = calculateShiftSummary({ businessDate: BUSINESS_DATE, shift: 'day', checkins });
    expect(day.totalRevenue).toBe(65);
    expect(day.totalCars).toBe(1);
  });

  it('includes admin past entry and edited-style cost on the check-in time shift', () => {
    const checkins = [
      room({ time: '15:30', cost: 99, is_past_entry: true, past_entry_source: 'admin_past_room_checkin' }),
    ];
    const day = calculateShiftSummary({ businessDate: BUSINESS_DATE, shift: 'day', checkins });
    expect(day.totalRevenue).toBe(99);
    expect(day.totalCars).toBe(1);
  });
});

describe('rooms turned over', () => {
  it('counts checkout+clean in same shift', () => {
    const turnovers: RoomTurnoverRecord[] = [
      {
        id: 'stay-1',
        checkedOutAt: atLocal(BUSINESS_DATE, 9, 0),
        cleanedAt: atLocal(BUSINESS_DATE, 9, 20),
      },
    ];
    const day = calculateShiftSummary({
      businessDate: BUSINESS_DATE,
      shift: 'day',
      checkins: [],
      turnovers,
    });
    expect(day.roomsTurnedOver).toBe(1);
  });

  it('attributes turnover to the shift when cleaning completed (checkout may be prior)', () => {
    const turnovers: RoomTurnoverRecord[] = [
      {
        id: 'stay-2',
        checkedOutAt: atLocal(BUSINESS_DATE, 7, 50),
        cleanedAt: atLocal(BUSINESS_DATE, 8, 20),
      },
    ];
    const overnight = calculateShiftSummary({
      businessDate: BUSINESS_DATE,
      shift: 'overnight',
      checkins: [],
      turnovers,
    });
    const day = calculateShiftSummary({
      businessDate: BUSINESS_DATE,
      shift: 'day',
      checkins: [],
      turnovers,
    });
    expect(overnight.roomsTurnedOver).toBe(0);
    expect(day.roomsTurnedOver).toBe(1);
  });

  it('does not count checkout without cleaning', () => {
    // Missing cleanedAt is represented by omitting from turnovers list (repo only emits complete pairs).
    const turnovers: RoomTurnoverRecord[] = [];
    const day = calculateShiftSummary({
      businessDate: BUSINESS_DATE,
      shift: 'day',
      checkins: [],
      turnovers,
    });
    expect(day.roomsTurnedOver).toBe(0);
  });

  it('does not count cleaning without valid preceding checkout (checkedOutAt after cleanedAt)', () => {
    const turnovers: RoomTurnoverRecord[] = [
      {
        id: 'bad',
        checkedOutAt: atLocal(BUSINESS_DATE, 10, 0),
        cleanedAt: atLocal(BUSINESS_DATE, 9, 0),
      },
    ];
    const day = calculateShiftSummary({
      businessDate: BUSINESS_DATE,
      shift: 'day',
      checkins: [],
      turnovers,
    });
    expect(day.roomsTurnedOver).toBe(0);
  });

  it('counts two legitimate stays for the same physical room as two turnovers', () => {
    const turnovers: RoomTurnoverRecord[] = [
      {
        id: 'stay-a',
        checkedOutAt: atLocal(BUSINESS_DATE, 9, 0),
        cleanedAt: atLocal(BUSINESS_DATE, 9, 15),
      },
      {
        id: 'stay-b',
        checkedOutAt: atLocal(BUSINESS_DATE, 14, 0),
        cleanedAt: atLocal(BUSINESS_DATE, 14, 30),
      },
    ];
    const day = calculateShiftSummary({
      businessDate: BUSINESS_DATE,
      shift: 'day',
      checkins: [],
      turnovers,
    });
    expect(day.roomsTurnedOver).toBe(2);
  });

  it('dedupes duplicate cleaning events for the same stay id', () => {
    const cleaned = atLocal(BUSINESS_DATE, 10, 0);
    const turnovers: RoomTurnoverRecord[] = [
      { id: 'stay-dup', checkedOutAt: cleaned, cleanedAt: cleaned },
      { id: 'stay-dup', checkedOutAt: cleaned, cleanedAt: cleaned },
    ];
    const day = calculateShiftSummary({
      businessDate: BUSINESS_DATE,
      shift: 'day',
      checkins: [],
      turnovers,
    });
    expect(day.roomsTurnedOver).toBe(1);
  });

  it('cleaning exactly at shift boundary belongs only to the new shift', () => {
    const turnovers: RoomTurnoverRecord[] = [
      {
        id: 'boundary',
        checkedOutAt: atLocal(BUSINESS_DATE, 15, 50),
        cleanedAt: atLocal(BUSINESS_DATE, 16, 0),
      },
    ];
    const day = calculateShiftSummary({
      businessDate: BUSINESS_DATE,
      shift: 'day',
      checkins: [],
      turnovers,
    });
    const evening = calculateShiftSummary({
      businessDate: BUSINESS_DATE,
      shift: 'evening',
      checkins: [],
      turnovers,
    });
    expect(day.roomsTurnedOver).toBe(0);
    expect(evening.roomsTurnedOver).toBe(1);
  });

  it('cleaning at midnight belongs to next business date overnight, not prior evening', () => {
    const turnovers: RoomTurnoverRecord[] = [
      {
        id: 'midnight',
        checkedOutAt: atLocal(BUSINESS_DATE, 23, 30),
        cleanedAt: atLocal('2026-08-24', 0, 0),
      },
    ];
    const evening = calculateShiftSummary({
      businessDate: BUSINESS_DATE,
      shift: 'evening',
      checkins: [],
      turnovers,
    });
    const nextOvernight = calculateShiftSummary({
      businessDate: '2026-08-24',
      shift: 'overnight',
      checkins: [],
      turnovers,
    });
    expect(evening.roomsTurnedOver).toBe(0);
    expect(nextOvernight.roomsTurnedOver).toBe(1);
  });
});

describe('calculateDayShiftSummaries', () => {
  it('returns three summaries that sum to day revenue/cars', () => {
    const checkins = [
      room({ time: '01:00', cost: 10 }),
      room({ time: '12:00', cost: 20 }),
      room({ time: '20:00', cost: 30 }),
    ];
    const summaries = calculateDayShiftSummaries(BUSINESS_DATE, checkins, []);
    expect(summaries).toHaveLength(3);
    const summed = sumShiftMetrics(summaries);
    expect(summed.totalRevenue).toBe(60);
    expect(summed.totalCars).toBe(3);
    expect(totalsToCents(checkins).totalCents).toBe(6000);
  });
});
