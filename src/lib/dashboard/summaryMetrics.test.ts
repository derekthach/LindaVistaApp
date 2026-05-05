import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import {
  computeTodaySamePointTotals,
  computeWeeklySamePointTotals,
  getCheckinAtInZone,
} from './summaryMetrics';
import type { CheckIn } from '@/types';

const ZONE = 'America/Puerto_Rico';

function row(over: Partial<CheckIn>): CheckIn {
  return {
    receipt_number: '1',
    date: '2026-05-02',
    time: '10:00',
    checkInType: 'room',
    room_id: 1,
    cost: 40,
    payment_method: 'cash',
    staff_name: 'S',
    car_plate: 'X',
    car_make: 'Y',
    car_color: 'black',
    ...over,
  };
}

describe('computeWeeklySamePointTotals', () => {
  it('compares current Fri→now vs prior Fri→same elapsed instant', () => {
    /** Sun May 4 2026 15:00 PR — motels week started Fri May 2; prior segment ends ~Apr 27 15:00 */
    const now = DateTime.fromObject(
      { year: 2026, month: 5, day: 4, hour: 15, minute: 0 },
      { zone: ZONE }
    );
    const checkins: CheckIn[] = [
      row({ date: '2026-05-02', time: '10:00', receipt_number: 'c1', cost: 50 }),
      row({ date: '2026-04-26', time: '10:00', receipt_number: 'p1', cost: 50 }),
    ];
    const r = computeWeeklySamePointTotals(checkins, now, ZONE);
    expect(r.carsThisWeek).toBe(1);
    expect(r.weekCarsDeltaVsPrior).toBe(0);
    expect(r.weekRevenueDeltaVsPrior).toBe(0);
  });
});

describe('computeTodaySamePointTotals', () => {
  it('uses today midnight→now vs yesterday midnight→same elapsed time', () => {
    /** Sun May 4 2026 15:00 PR — yesterday window ends May 3 15:00 */
    const now = DateTime.fromObject(
      { year: 2026, month: 5, day: 4, hour: 15, minute: 0 },
      { zone: ZONE }
    );
    const checkins: CheckIn[] = [
      row({ date: '2026-05-04', time: '10:00', receipt_number: 't1', cost: 100 }),
      row({ date: '2026-05-03', time: '10:00', receipt_number: 'y1', cost: 80 }),
    ];
    const r = computeTodaySamePointTotals(checkins, now, ZONE);
    expect(r.carsToday).toBe(1);
    expect(r.profitToday).toBe(100);
    expect(r.todayCarsDeltaVsYesterday).toBe(0);
    expect(r.todayRevenueDeltaVsYesterday).toBe(20);
  });

  it('excludes yesterday activity after the aligned cutoff time', () => {
    const now = DateTime.fromObject(
      { year: 2026, month: 5, day: 4, hour: 15, minute: 0 },
      { zone: ZONE }
    );
    const checkins: CheckIn[] = [
      row({ date: '2026-05-04', time: '14:00', receipt_number: 't', cost: 100 }),
      row({ date: '2026-05-03', time: '16:00', receipt_number: 'late', cost: 999 }),
    ];
    const r = computeTodaySamePointTotals(checkins, now, ZONE);
    expect(r.profitToday).toBe(100);
    expect(r.todayRevenueDeltaVsYesterday).toBe(100);
  });
});

describe('getCheckinAtInZone', () => {
  it('parses date+time in Puerto Rico', () => {
    const t = getCheckinAtInZone(row({ date: '2026-05-03', time: '14:30' }), ZONE);
    expect(t.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-05-03 14:30');
  });
});
