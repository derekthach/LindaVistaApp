import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { deriveCalendarMonthRoomTrendFromCheckins } from './calendarMonthTrendData';
import type { CheckIn } from '@/types';

const ZONE = 'America/Puerto_Rico';

function baseCheckin(over: Partial<CheckIn>): CheckIn {
  return {
    receipt_number: '1',
    date: '2026-05-02',
    time: '12:00',
    checkInType: 'room',
    room_id: 10,
    cost: 40,
    payment_method: 'cash',
    staff_name: 'X',
    car_plate: 'ABC',
    car_make: 'Y',
    car_color: 'black',
    ...over,
  };
}

describe('deriveCalendarMonthRoomTrendFromCheckins', () => {
  it('includes every calendar day in PR month with zeros where no room rows', () => {
    const now = DateTime.fromObject({ year: 2026, month: 5, day: 8, hour: 12 }, { zone: ZONE });
    const checkins: CheckIn[] = [
      baseCheckin({ date: '2026-05-01', receipt_number: 'a', cost: 100 }),
      baseCheckin({
        date: '2026-05-01',
        receipt_number: 'b',
        checkInType: 'food',
        lineItems: [{ itemId: 'x', itemLabel: 'Snack', quantitySold: 1, amountCollected: 5 }],
        cost: 5,
      }),
    ];
    const d = deriveCalendarMonthRoomTrendFromCheckins(checkins, now, ZONE);
    expect(d.trendAxisIsos).toHaveLength(31);
    expect(d.roomCheckinsPrevMonth).toHaveLength(31);
    expect(d.roomRevenuePrevMonth).toHaveLength(31);
    expect(d.roomCheckins[0]).toBe(1);
    expect(d.roomRevenue[0]).toBe(100);
    expect(d.roomCheckins[1]).toBe(0);
    expect(d.roomRevenue[1]).toBe(0);
    expect(d.roomCheckinsPrevMonth[0]).toBe(0);
  });

  it('aligns previous month by calendar day (April 15 vs May 15)', () => {
    const now = DateTime.fromObject({ year: 2026, month: 5, day: 15, hour: 12 }, { zone: ZONE });
    const checkins: CheckIn[] = [
      baseCheckin({ date: '2026-04-15', receipt_number: 'p', cost: 50 }),
      baseCheckin({ date: '2026-05-15', receipt_number: 'c', cost: 80 }),
    ];
    const d = deriveCalendarMonthRoomTrendFromCheckins(checkins, now, ZONE);
    const idx14 = 14;
    expect(d.roomCheckins[idx14]).toBe(1);
    expect(d.roomRevenue[idx14]).toBe(80);
    expect(d.roomCheckinsPrevMonth[idx14]).toBe(1);
    expect(d.roomRevenuePrevMonth[idx14]).toBe(50);
  });
});
