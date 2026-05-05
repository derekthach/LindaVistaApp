import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { deriveMotelWeekTrendComparisonFromCheckins } from './motelWeekTrendData';
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

describe('deriveMotelWeekTrendComparisonFromCheckins', () => {
  it('returns 7 aligned days with previous week dashed-series data', () => {
    /** Wednesday 2026-05-06 PR — motel week started 2026-05-02 (Fri) */
    const now = DateTime.fromObject(
      { year: 2026, month: 5, day: 6, hour: 12 },
      { zone: ZONE }
    );
    const checkins: CheckIn[] = [
      baseCheckin({ date: '2026-04-25', receipt_number: 'p1', cost: 10 }),
      baseCheckin({ date: '2026-05-03', receipt_number: 'c1', cost: 20 }),
    ];
    const d = deriveMotelWeekTrendComparisonFromCheckins(checkins, now, ZONE);
    expect(d.dates).toHaveLength(7);
    expect(d.trendAxisIsos).toHaveLength(7);
    expect(d.trendAxisIsos[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(d.checkinsPrevWeek.some((n) => n > 0)).toBe(true);
    expect(d.checkins.some((n) => n > 0)).toBe(true);
    expect(d.revenuePrevWeek.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(d.revenue.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });
});
