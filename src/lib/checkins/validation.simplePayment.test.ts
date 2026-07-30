import { describe, expect, it } from 'vitest';
import { validateSimpleCheckin } from './validation';

describe('validateSimpleCheckin payment splits', () => {
  const base = {
    date: '2026-07-01',
    time: '14:30',
    staff_name: 'Derek Thach',
    checkInType: 'food' as const,
    lineItems: [
      { itemId: 'soda', itemLabel: 'Soda', quantitySold: 1, amountCollected: 19 },
    ],
  };

  it('accepts a single payment method (employee / legacy path)', () => {
    const result = validateSimpleCheckin({
      ...base,
      payment_method: 'cash',
    });
    expect(result.valid).toBe(true);
    expect(result.payment_splits).toBeUndefined();
  });

  it('accepts multi-payment splits that match the line-item total', () => {
    const result = validateSimpleCheckin({
      ...base,
      payment_splits: [
        { method: 'cash', amount: 10 },
        { method: 'ath_mobil', amount: 6 },
        { method: 'venmo', amount: 3 },
      ],
    });
    expect(result.valid).toBe(true);
    expect(result.payment_splits).toEqual([
      { method: 'cash', amount: 10 },
      { method: 'ath_mobil', amount: 6 },
      { method: 'venmo', amount: 3 },
    ]);
  });

  it('rejects when payment total does not match check-in total', () => {
    const result = validateSimpleCheckin({
      ...base,
      checkInType: 'beer',
      payment_splits: [
        { method: 'cash', amount: 10 },
        { method: 'ath_mobil', amount: 6 },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.payment_splits).toBe('err_payment_total_mismatch');
  });

  it('rejects duplicate payment methods in splits', () => {
    const result = validateSimpleCheckin({
      ...base,
      payment_splits: [
        { method: 'cash', amount: 10 },
        { method: 'cash', amount: 9 },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.payment_splits).toBe('err_payment_duplicate_method');
  });
});
