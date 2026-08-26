import { describe, expect, it } from 'vitest';
import { getCheckInPaymentMethodValues } from '@/lib/checkins/paymentMethods';

describe('getCheckInPaymentMethodValues', () => {
  it('returns empty when payment data is missing', () => {
    expect(getCheckInPaymentMethodValues({ payment_method: '' })).toEqual([]);
    expect(getCheckInPaymentMethodValues({ payment_method: '   ' })).toEqual([]);
    expect(getCheckInPaymentMethodValues({ payment_method: 'unknown' })).toEqual([]);
  });

  it('reads legacy single payment_method', () => {
    expect(getCheckInPaymentMethodValues({ payment_method: 'cash' })).toEqual(['cash']);
    expect(getCheckInPaymentMethodValues({ payment_method: 'ATH_MOBIL' })).toEqual(['ath_mobil']);
    expect(getCheckInPaymentMethodValues({ payment_method: 'Cash' })).toEqual(['cash']);
  });

  it('prefers payment_splits and keeps order without duplicates', () => {
    expect(
      getCheckInPaymentMethodValues({
        payment_method: 'cash',
        payment_splits: [
          { method: 'venmo', amount: 10 },
          { method: 'cash', amount: 20 },
          { method: 'venmo', amount: 5 },
        ],
      })
    ).toEqual(['venmo', 'cash']);
  });

  it('falls back to payment_method when splits have no valid methods', () => {
    expect(
      getCheckInPaymentMethodValues({
        payment_method: 'paypal',
        payment_splits: [{ method: 'nope', amount: 10 }],
      })
    ).toEqual(['paypal']);
  });
});
