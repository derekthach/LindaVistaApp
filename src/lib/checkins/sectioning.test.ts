import { describe, expect, it } from 'vitest';
import { buildSectionedData, countsAsCar, totalsToCents } from './sectioning';
import type { CheckIn } from '@/types';

function baseRoom(over: Partial<CheckIn> = {}): CheckIn {
  return {
    receipt_number: '1',
    date: '2026-05-03',
    time: '02:30',
    checkInType: 'room',
    room_id: 29,
    cost: 35,
    payment_method: 'cash',
    staff_name: 'Test',
    car_plate: '',
    car_make: '',
    car_color: 'black',
    ...over,
  };
}

describe('countsAsCar / section totals', () => {
  it('counts a room check-in as a car even with no license plate (admin/past room flow)', () => {
    const c = baseRoom({ car_plate: '', receipt_number: '96707' });
    expect(countsAsCar(c)).toBe(true);
  });

  it('does not count food or beer as cars', () => {
    expect(countsAsCar(baseRoom({ checkInType: 'food', cost: 10 }))).toBe(false);
    expect(countsAsCar(baseRoom({ checkInType: 'beer', cost: 5 }))).toBe(false);
  });

  it('section car count matches number of room rows including is_past_entry and split rooms', () => {
    const checkins: CheckIn[] = [
      baseRoom({ receipt_number: '96707', time: '02:30', room_id: 29, car_plate: '' }),
      baseRoom({ receipt_number: '96708', time: '02:45', room_id: '14B', car_plate: '' }),
      baseRoom({ receipt_number: '96709', time: '02:45', room_id: '15B' }),
      baseRoom({
        receipt_number: '96710',
        time: '03:20',
        is_past_entry: true,
        past_entry_source: 'admin_past_room_checkin',
        car_plate: '',
      }),
    ];
    const { sectionTotals, dayTotals } = buildSectionedData(checkins);
    const nightCars = sectionTotals[0]!.carCount;
    expect(nightCars).toBe(4);
    expect(dayTotals.carCount).toBe(4);
    const t = totalsToCents(checkins);
    expect(t.carCount).toBe(4);
  });
});
