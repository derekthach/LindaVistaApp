import { describe, expect, it } from 'vitest';
import { deriveRoomUsageForWeekFromCheckins } from './roomUsageWeekData';
import type { CheckIn } from '@/types';

function row(over: Partial<CheckIn>): CheckIn {
  return {
    receipt_number: '1',
    date: '2026-05-29',
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

describe('deriveRoomUsageForWeekFromCheckins', () => {
  const weekStart = '2026-05-29'; // Fri

  it('counts room check-ins within Fri–Thu motel week only', () => {
    const checkins: CheckIn[] = [
      row({ date: '2026-05-29', room_id: 5, receipt_number: 'a' }),
      row({ date: '2026-06-04', room_id: 5, receipt_number: 'b' }),
      row({ date: '2026-06-05', room_id: 5, receipt_number: 'c' }), // next Fri
      row({ date: '2026-05-28', room_id: 5, receipt_number: 'd' }), // prior Thu
    ];
    const result = deriveRoomUsageForWeekFromCheckins(checkins, weekStart);
    expect(result.usage_counts).toEqual([2]);
    expect(result.room_numbers).toEqual(['Room 5']);
    expect(result.week_start).toBe('2026-05-29');
    expect(result.week_end).toBe('2026-06-04');
  });

  it('includes admin late/past room entries', () => {
    const checkins: CheckIn[] = [
      row({ date: '2026-05-30', room_id: 12, is_past_entry: true, receipt_number: 'late' }),
    ];
    const result = deriveRoomUsageForWeekFromCheckins(checkins, weekStart);
    expect(result.usage_counts).toEqual([1]);
  });

  it('excludes food/beer and returns top 10 by count without zero-usage rooms', () => {
    const checkins: CheckIn[] = [];
    for (let i = 1; i <= 12; i++) {
      for (let j = 0; j <= 12 - i; j++) {
        checkins.push(
          row({
            date: '2026-05-29',
            room_id: i,
            receipt_number: `r${i}-${j}`,
          })
        );
      }
    }
    checkins.push(
      row({
        date: '2026-05-29',
        checkInType: 'food',
        room_id: 99,
        receipt_number: 'food',
        lineItems: [{ itemId: 'soda', itemLabel: 'Soda', amountCollected: 2, quantitySold: 1 }],
      })
    );
    const result = deriveRoomUsageForWeekFromCheckins(checkins, weekStart);
    expect(result.room_numbers).toHaveLength(10);
    expect(result.room_numbers[0]).toBe('Room 1');
    expect(result.usage_counts[0]).toBe(12);
    expect(result.max_count).toBe(12);
  });

  it('uses latest saved room_id on the normalized record', () => {
    const checkins: CheckIn[] = [row({ date: '2026-05-29', room_id: 20, receipt_number: 'edited' })];
    const result = deriveRoomUsageForWeekFromCheckins(checkins, weekStart);
    expect(result.room_numbers).toEqual(['Room 20']);
  });
});
