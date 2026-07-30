import { describe, expect, it } from 'vitest';
import {
  FOOD_BEER_PAYMENT_SPLIT_OPTIONS,
  paymentStateToFormRows,
  validatePaymentSplits,
  validatePaymentSplitsForExpectedTotal,
} from './roomPaymentSplits';
import { validateAdminPastFoodBeerMulti } from './validation/adminPastFoodBeerMulti';
import { paymentMethodTotalsToCents } from './sectioning';
import type { CheckIn } from '@/types';
import type { ItemOption } from '@/lib/checkins/items';

const CATALOG: ItemOption[] = [
  { id: 'soda', label: { en: 'Soda', es: 'Refresco' } },
];

describe('paymentStateToFormRows', () => {
  it('loads multi-split rows without alteration', () => {
    expect(
      paymentStateToFormRows(
        [
          { method: 'cash', amount: 10 },
          { method: 'ath_mobil', amount: 9 },
        ],
        'cash',
        19
      )
    ).toEqual([
      { method: 'cash', amount: '10' },
      { method: 'ath_mobil', amount: '9' },
    ]);
  });

  it('converts legacy single payment method + amount into one row', () => {
    expect(paymentStateToFormRows(undefined, 'Venmo', 19)).toEqual([
      { method: 'venmo', amount: '19' },
    ]);
  });
});

describe('validatePaymentSplitsForExpectedTotal', () => {
  it('accepts splits that match the check-in total', () => {
    const result = validatePaymentSplitsForExpectedTotal(
      [
        { method: 'cash', amount: 10 },
        { method: 'ath_mobil', amount: 6 },
        { method: 'venmo', amount: 3 },
      ],
      19,
      FOOD_BEER_PAYMENT_SPLIT_OPTIONS
    );
    expect(result.valid).toBe(true);
    expect(result.splits).toHaveLength(3);
  });

  it('rejects when assigned total does not match expected', () => {
    const result = validatePaymentSplitsForExpectedTotal(
      [
        { method: 'cash', amount: 10 },
        { method: 'ath_mobil', amount: 6 },
      ],
      19,
      FOOD_BEER_PAYMENT_SPLIT_OPTIONS
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe('err_payment_total_mismatch');
    expect(result.expectedTotal).toBe(19);
    expect(result.assignedTotal).toBe(16);
  });

  it('rejects duplicate payment methods', () => {
    const result = validatePaymentSplits([
      { method: 'cash', amount: 10 },
      { method: 'cash', amount: 9 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('err_payment_duplicate_method');
  });
});

describe('validateAdminPastFoodBeerMulti multi-payment', () => {
  const staff = ['Derek Thach'];

  it('saves with multiple payment methods totaling line items', () => {
    const result = validateAdminPastFoodBeerMulti(
      {
        date: '2026-07-01',
        time: '14:30',
        staff_name: 'Derek Thach',
        lineItems: JSON.stringify([
          { itemId: 'soda', itemLabel: 'Soda', quantitySold: 1, amountCollected: 19 },
        ]),
        payment_splits: JSON.stringify([
          { method: 'cash', amount: 10 },
          { method: 'ath_mobil', amount: 6 },
          { method: 'venmo', amount: 3 },
        ]),
      },
      staff,
      CATALOG
    );
    expect(result.valid).toBe(true);
    expect(result.payment_splits).toEqual([
      { method: 'cash', amount: 10 },
      { method: 'ath_mobil', amount: 6 },
      { method: 'venmo', amount: 3 },
    ]);
    expect(result.payment_method).toBe('cash');
  });

  it('rejects payment total mismatch with clear message', () => {
    const result = validateAdminPastFoodBeerMulti(
      {
        date: '2026-07-01',
        time: '14:30',
        staff_name: 'Derek Thach',
        lineItems: JSON.stringify([
          { itemId: 'soda', itemLabel: 'Soda', quantitySold: 1, amountCollected: 19 },
        ]),
        payment_splits: JSON.stringify([
          { method: 'cash', amount: 10 },
          { method: 'ath_mobil', amount: 6 },
        ]),
      },
      staff,
      CATALOG
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      'Payment methods must total $19.00. Currently assigned: $16.00. Remaining: $3.00.'
    );
  });
});

describe('paymentMethodTotalsToCents food/beer splits', () => {
  it('attributes food revenue across payment splits', () => {
    const checkins: CheckIn[] = [
      {
        receipt_number: '',
        date: '2026-07-01',
        time: '14:00',
        room_id: 0,
        cost: 19,
        payment_method: 'cash',
        staff_name: 'Derek',
        car_plate: '',
        car_make: '',
        car_color: '',
        checkInType: 'food',
        payment_splits: [
          { method: 'cash', amount: 10 },
          { method: 'ath_mobil', amount: 9 },
        ],
      },
    ];
    expect(paymentMethodTotalsToCents(checkins)).toEqual([
      { method: 'cash', cents: 1000 },
      { method: 'ath_mobil', cents: 900 },
    ]);
  });

  it('keeps legacy single-method food attribution', () => {
    const checkins: CheckIn[] = [
      {
        receipt_number: '',
        date: '2026-07-01',
        time: '14:00',
        room_id: 0,
        cost: 25,
        payment_method: 'venmo',
        staff_name: 'Derek',
        car_plate: '',
        car_make: '',
        car_color: '',
        checkInType: 'food',
      },
    ];
    expect(paymentMethodTotalsToCents(checkins)).toEqual([{ method: 'venmo', cents: 2500 }]);
  });
});
