import { describe, expect, it } from 'vitest';
import {
  applyAdvancedFilters,
  countActiveAdvancedFilters,
  parseAdvancedFiltersFromSearchParams,
  type AdvancedCheckinsFilters,
} from './advancedFilters';
import type { CheckIn } from '@/types';

function base(over: Partial<CheckIn> = {}): CheckIn {
  return {
    receipt_number: '84496',
    date: '2026-08-20',
    time: '07:05',
    checkInType: 'room',
    room_id: 12,
    cost: 65,
    payment_method: 'cash',
    staff_name: 'Luis',
    car_plate: '',
    car_make: '',
    car_color: 'black',
    ...over,
  };
}

const empty: AdvancedCheckinsFilters = {
  receipt: '',
  shift: '',
  type: '',
  room: '',
  staff: '',
  payment: '',
};

describe('parseAdvancedFiltersFromSearchParams', () => {
  it('parses valid values and ignores junk', () => {
    expect(
      parseAdvancedFiltersFromSearchParams({
        receipt: ' 84496 ',
        shift: '0',
        type: 'beer',
        room: '14A',
        staff: 'Luis',
        payment: 'ath_mobil',
      })
    ).toEqual({
      receipt: '84496',
      shift: '0',
      type: 'beer',
      room: '14A',
      staff: 'Luis',
      payment: 'ath_mobil',
    });
    expect(parseAdvancedFiltersFromSearchParams({ shift: '9', type: 'x', payment: 'btc' })).toEqual(
      empty
    );
  });
});

describe('applyAdvancedFilters', () => {
  const rows: CheckIn[] = [
    base({ receipt_number: '84496', time: '07:05', staff_name: 'Luis', checkInType: 'room', room_id: 12 }),
    base({
      receipt_number: '84497',
      time: '10:00',
      staff_name: 'Noel',
      checkInType: 'food',
      room_id: 0,
      cost: 12,
      payment_method: 'venmo',
    }),
    base({
      receipt_number: '84498',
      time: '17:00',
      staff_name: 'Luis',
      checkInType: 'beer',
      room_id: 0,
      cost: 8,
      payment_splits: [
        { method: 'cash', amount: 3 },
        { method: 'ath_mobil', amount: 5 },
      ],
    }),
  ];

  it('matches receipt exactly after padding', () => {
    const out = applyAdvancedFilters(rows, { ...empty, receipt: '84496' });
    expect(out).toHaveLength(1);
    expect(out[0]!.receipt_number).toBe('84496');
  });

  it('filters by View Check-ins shift bucket', () => {
    expect(applyAdvancedFilters(rows, { ...empty, shift: '0' }).map((c) => c.receipt_number)).toEqual([
      '84496',
    ]);
    expect(applyAdvancedFilters(rows, { ...empty, shift: '1' }).map((c) => c.receipt_number)).toEqual([
      '84497',
    ]);
    expect(applyAdvancedFilters(rows, { ...empty, shift: '2' }).map((c) => c.receipt_number)).toEqual([
      '84498',
    ]);
  });

  it('ANDs staff + type', () => {
    const out = applyAdvancedFilters(rows, { ...empty, staff: 'Luis', type: 'room' });
    expect(out).toHaveLength(1);
    expect(out[0]!.receipt_number).toBe('84496');
  });

  it('matches payment if method appears in splits', () => {
    expect(applyAdvancedFilters(rows, { ...empty, payment: 'cash' }).map((c) => c.receipt_number)).toEqual([
      '84496',
      '84498',
    ]);
    expect(
      applyAdvancedFilters(rows, { ...empty, payment: 'ath_mobil' }).map((c) => c.receipt_number)
    ).toEqual(['84498']);
    expect(applyAdvancedFilters(rows, { ...empty, payment: 'paypal' })).toHaveLength(0);
  });

  it('counts non-date advanced filters', () => {
    expect(countActiveAdvancedFilters(empty)).toBe(0);
    expect(countActiveAdvancedFilters({ ...empty, staff: 'Luis', type: 'room' })).toBe(2);
  });
});
