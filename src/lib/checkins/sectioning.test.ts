import { describe, expect, it } from 'vitest';
import {
  buildRangeSectionedData,
  buildSectionedData,
  countsAsCar,
  paymentMethodTotalsToCents,
  sumSectionTotals,
  totalsToCents,
} from './sectioning';
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

  it('weights room/car counts by receipts_captured without multiplying revenue', () => {
    const checkins: CheckIn[] = [
      baseRoom({ receipt_number: '1', cost: 65 }),
      baseRoom({
        receipt_number: '2',
        cost: 975,
        is_past_entry: true,
        receipts_captured: 15,
      }),
      baseRoom({
        checkInType: 'food',
        cost: 300,
        is_past_entry: true,
        receipts_captured: 12,
      }),
    ];
    const totals = totalsToCents(checkins);
    expect(totals.carCount).toBe(16);
    expect(totals.roomCents).toBe(104000);
    expect(totals.foodCents).toBe(30000);
    expect(totals.totalCents).toBe(134000);
  });
});

describe('paymentMethodTotalsToCents', () => {
  it('splits room revenue by payment method and includes food and beer totals', () => {
    const checkins: CheckIn[] = [
      baseRoom({
        receipt_number: '96711',
        cost: 65,
        total_collected: 65,
        payment_splits: [
          { method: 'cash', amount: 40 },
          { method: 'ath_mobil', amount: 25 },
        ],
      }),
      baseRoom({
        receipt_number: '96712',
        checkInType: 'food',
        room_id: 0,
        cost: 25,
        payment_method: 'Venmo',
      }),
      baseRoom({
        receipt_number: '96713',
        checkInType: 'beer',
        room_id: 0,
        cost: 15,
        payment_method: ' cash ',
      }),
    ];

    expect(paymentMethodTotalsToCents(checkins)).toEqual([
      { method: 'cash', cents: 5500 },
      { method: 'ath_mobil', cents: 2500 },
      { method: 'venmo', cents: 2500 },
    ]);
  });

  it('routes missing payment data to unspecified without showing zero-value methods', () => {
    const checkins: CheckIn[] = [
      baseRoom({
        receipt_number: '96714',
        cost: 25,
        total_collected: 25,
        payment_splits: [{ method: 'cash', amount: 10 }],
      }),
      baseRoom({
        receipt_number: '96715',
        checkInType: 'food',
        room_id: 0,
        cost: 5,
        payment_method: '',
      }),
      baseRoom({
        receipt_number: '96716',
        checkInType: 'beer',
        room_id: 0,
        cost: 0,
        payment_method: 'paypal',
      }),
    ];

    expect(paymentMethodTotalsToCents(checkins)).toEqual([
      { method: 'cash', cents: 1000 },
      { method: 'unspecified', cents: 2000 },
    ]);
  });

  it('attributes a single Cash payment', () => {
    expect(
      paymentMethodTotalsToCents([
        baseRoom({ cost: 35, total_collected: 35, payment_method: 'cash', payment_splits: undefined }),
      ])
    ).toEqual([{ method: 'cash', cents: 3500 }]);
  });

  it('attributes a single ATH Móvil payment', () => {
    expect(
      paymentMethodTotalsToCents([
        baseRoom({
          cost: 40,
          total_collected: 40,
          payment_method: 'ath_mobil',
          payment_splits: undefined,
        }),
      ])
    ).toEqual([{ method: 'ath_mobil', cents: 4000 }]);
  });

  it('aggregates multiple different payment methods across several entries', () => {
    const checkins: CheckIn[] = [
      baseRoom({ receipt_number: '1', cost: 10, payment_method: 'cash' }),
      baseRoom({ receipt_number: '2', cost: 20, payment_method: 'venmo' }),
      baseRoom({ receipt_number: '3', cost: 15, payment_method: 'paypal' }),
      baseRoom({ receipt_number: '4', cost: 5, payment_method: 'cash_app' }),
    ];
    expect(paymentMethodTotalsToCents(checkins)).toEqual([
      { method: 'cash', cents: 1000 },
      { method: 'venmo', cents: 2000 },
      { method: 'paypal', cents: 1500 },
      { method: 'cash_app', cents: 500 },
    ]);
  });

  it('attributes one entry containing split payments by method amounts', () => {
    expect(
      paymentMethodTotalsToCents([
        baseRoom({
          cost: 35,
          total_collected: 35,
          payment_splits: [
            { method: 'cash', amount: 20 },
            { method: 'ath_mobil', amount: 15 },
          ],
        }),
      ])
    ).toEqual([
      { method: 'cash', cents: 2000 },
      { method: 'ath_mobil', cents: 1500 },
    ]);
  });

  it('aggregates multiple entries that each contain split payments', () => {
    const checkins: CheckIn[] = [
      baseRoom({
        receipt_number: 'a',
        cost: 35,
        total_collected: 35,
        payment_splits: [
          { method: 'cash', amount: 20 },
          { method: 'ath_mobil', amount: 15 },
        ],
      }),
      baseRoom({
        receipt_number: 'b',
        checkInType: 'food',
        room_id: 0,
        cost: 19,
        payment_splits: [
          { method: 'cash', amount: 9 },
          { method: 'venmo', amount: 10 },
        ],
      }),
    ];
    expect(paymentMethodTotalsToCents(checkins)).toEqual([
      { method: 'cash', cents: 2900 },
      { method: 'ath_mobil', cents: 1500 },
      { method: 'venmo', cents: 1000 },
    ]);
  });

  it('supports legacy single-payment records without payment_splits', () => {
    expect(
      paymentMethodTotalsToCents([
        baseRoom({ cost: 50, payment_method: 'PayPal', payment_splits: undefined }),
      ])
    ).toEqual([{ method: 'paypal', cents: 5000 }]);
  });

  it('supports mixed legacy single-payment and new split-payment records', () => {
    const checkins: CheckIn[] = [
      baseRoom({
        receipt_number: 'legacy',
        cost: 30,
        payment_method: 'cash',
        payment_splits: undefined,
      }),
      baseRoom({
        receipt_number: 'split',
        cost: 35,
        total_collected: 35,
        payment_splits: [
          { method: 'ath_mobil', amount: 20 },
          { method: 'venmo', amount: 15 },
        ],
      }),
    ];
    expect(paymentMethodTotalsToCents(checkins)).toEqual([
      { method: 'cash', cents: 3000 },
      { method: 'ath_mobil', cents: 2000 },
      { method: 'venmo', cents: 1500 },
    ]);
  });

  it('sums payment-method cents to the monetary day total when payment data is complete', () => {
    const checkins: CheckIn[] = [
      baseRoom({
        receipt_number: '1',
        cost: 35,
        total_collected: 35,
        payment_splits: [
          { method: 'cash', amount: 20 },
          { method: 'ath_mobil', amount: 15 },
        ],
      }),
      baseRoom({
        receipt_number: '2',
        checkInType: 'beer',
        room_id: 0,
        cost: 4.5,
        payment_method: 'venmo',
      }),
      baseRoom({
        receipt_number: '3',
        checkInType: 'food',
        room_id: 0,
        cost: 12,
        payment_method: 'cash',
      }),
    ];
    const paymentCents = paymentMethodTotalsToCents(checkins).reduce((sum, row) => sum + row.cents, 0);
    expect(paymentCents).toBe(totalsToCents(checkins).totalCents);
    expect(paymentCents).toBe(5150);
  });

  it('recalculates when the selected day set of records changes', () => {
    const dayA: CheckIn[] = [
      baseRoom({ date: '2026-08-14', cost: 35, payment_method: 'cash' }),
    ];
    const dayB: CheckIn[] = [
      baseRoom({ date: '2026-08-15', cost: 40, payment_method: 'ath_mobil' }),
      baseRoom({
        date: '2026-08-15',
        receipt_number: '2',
        checkInType: 'beer',
        room_id: 0,
        cost: 5,
        payment_method: 'venmo',
      }),
    ];
    expect(paymentMethodTotalsToCents(dayA)).toEqual([{ method: 'cash', cents: 3500 }]);
    expect(paymentMethodTotalsToCents(dayB)).toEqual([
      { method: 'ath_mobil', cents: 4000 },
      { method: 'venmo', cents: 500 },
    ]);
  });
});

describe('buildRangeSectionedData / Selected Range Total', () => {
  it('sums day totals exactly across a multi-day range (cents + cars)', () => {
    const checkins: CheckIn[] = [
      baseRoom({ date: '2026-08-20', receipt_number: '1', time: '02:00', cost: 10.1 }),
      baseRoom({ date: '2026-08-20', receipt_number: '2', time: '10:00', cost: 20.2, checkInType: 'food' }),
      baseRoom({ date: '2026-08-21', receipt_number: '3', time: '03:00', cost: 30.3 }),
      baseRoom({
        date: '2026-08-21',
        receipt_number: '4',
        time: '17:00',
        cost: 5.05,
        checkInType: 'beer',
      }),
    ];

    const day20 = buildSectionedData(checkins.filter((c) => c.date === '2026-08-20'));
    const day21 = buildSectionedData(checkins.filter((c) => c.date === '2026-08-21'));
    const range = buildRangeSectionedData(checkins, ['2026-08-20', '2026-08-21']);

    expect(range.days).toHaveLength(2);
    expect(range.days[0]!.sectioned.dayTotals).toEqual(day20.dayTotals);
    expect(range.days[1]!.sectioned.dayTotals).toEqual(day21.dayTotals);

    const expected = sumSectionTotals([day20.dayTotals, day21.dayTotals]);
    expect(range.rangeTotals).toEqual(expected);
    expect(range.rangeTotals).toEqual(totalsToCents(checkins));

    // $10.10 + $20.20 + $30.30 + $5.05 = $65.65
    expect(range.rangeTotals.totalCents).toBe(6565);
    expect(range.rangeTotals.roomCents).toBe(4040);
    expect(range.rangeTotals.foodCents).toBe(2020);
    expect(range.rangeTotals.beerCents).toBe(505);
    expect(range.rangeTotals.carCount).toBe(2);
  });

  it('skips empty calendar dates without changing range totals', () => {
    const checkins: CheckIn[] = [
      baseRoom({ date: '2026-08-20', receipt_number: '1', cost: 50 }),
      baseRoom({ date: '2026-08-22', receipt_number: '2', cost: 25 }),
    ];
    const range = buildRangeSectionedData(checkins, ['2026-08-20', '2026-08-21', '2026-08-22']);
    expect(range.days.map((d) => d.dateISO)).toEqual(['2026-08-20', '2026-08-22']);
    expect(range.rangeTotals.totalCents).toBe(7500);
    expect(range.rangeTotals.carCount).toBe(2);
  });

  it('keeps a single day’s totals unchanged when more days are added to the range', () => {
    const day20Only: CheckIn[] = [
      baseRoom({ date: '2026-08-20', receipt_number: '1', time: '09:00', cost: 65 }),
    ];
    const withExtraDay: CheckIn[] = [
      ...day20Only,
      baseRoom({ date: '2026-08-21', receipt_number: '2', time: '09:00', cost: 40 }),
    ];
    const alone = buildSectionedData(day20Only).dayTotals;
    const inRange = buildRangeSectionedData(withExtraDay, ['2026-08-20', '2026-08-21']).days.find(
      (d) => d.dateISO === '2026-08-20'
    )!.sectioned.dayTotals;
    expect(inRange).toEqual(alone);
  });
});
