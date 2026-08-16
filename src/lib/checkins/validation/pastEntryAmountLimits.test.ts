import { describe, expect, it } from 'vitest';
import { validatePaymentSplits } from '../roomPaymentSplits';
import { validatePastRoomCheckinAdmin } from './pastRoomCheckin';
import { validateAdminPastFoodBeerMulti } from './adminPastFoodBeerMulti';
import type { ItemOption } from '@/lib/checkins/items';

const STAFF = ['Derek Thach'];
const CATALOG: ItemOption[] = [{ id: 'soda', label: { en: 'Soda', es: 'Refresco' } }];

function roomRaw(amount: number | { method: string; amount: number }[]) {
  const splits = Array.isArray(amount)
    ? amount
    : [{ method: 'cash', amount }];
  return {
    room_id: 1,
    check_in_date: '2026-08-14',
    check_in_time: '14:00',
    staff_name: 'Derek Thach',
    receipt_number: '12345',
    payment_splits: JSON.stringify(splits),
  };
}

function foodRaw(lineAmount: number, splits: { method: string; amount: number }[]) {
  return {
    date: '2026-08-14',
    time: '14:00',
    staff_name: 'Derek Thach',
    lineItems: JSON.stringify([
      { itemId: 'soda', itemLabel: 'Soda', quantitySold: 1, amountCollected: lineAmount },
    ]),
    payment_splits: JSON.stringify(splits),
  };
}

describe('Admin Add Past Entry amount limit ($5000)', () => {
  it('keeps current room check-in payment max at $1000 when no past-entry options are passed', () => {
    expect(validatePaymentSplits([{ method: 'cash', amount: 1000 }]).valid).toBe(true);
    expect(validatePaymentSplits([{ method: 'cash', amount: 1001 }]).valid).toBe(false);
    expect(validatePaymentSplits([{ method: 'cash', amount: 1001 }]).error).toBe('err_payment_row_max');
  });

  it.each([999, 1000, 1001, 4999, 5000])(
    'accepts past room payment of $%s',
    (amount) => {
      expect(validatePastRoomCheckinAdmin(roomRaw(amount), STAFF).valid).toBe(true);
    }
  );

  it('rejects past room payment of $5001', () => {
    const result = validatePastRoomCheckinAdmin(roomRaw(5001), STAFF);
    expect(result.valid).toBe(false);
    expect(result.errors.payment_splits).toBeDefined();
  });

  it('accepts past room split payments totaling $5000', () => {
    const result = validatePastRoomCheckinAdmin(
      roomRaw([
        { method: 'cash', amount: 3000 },
        { method: 'ath_mobil', amount: 2000 },
      ]),
      STAFF
    );
    expect(result.valid).toBe(true);
  });

  it('rejects past room split payments totaling $5001', () => {
    const result = validatePastRoomCheckinAdmin(
      roomRaw([
        { method: 'cash', amount: 3000 },
        { method: 'ath_mobil', amount: 2001 },
      ]),
      STAFF
    );
    expect(result.valid).toBe(false);
  });

  it.each([999, 1000, 1001, 4999, 5000])(
    'accepts past food/beer line item and payment of $%s',
    (amount) => {
      const result = validateAdminPastFoodBeerMulti(
        foodRaw(amount, [{ method: 'cash', amount }]),
        STAFF,
        CATALOG
      );
      expect(result.valid).toBe(true);
    }
  );

  it('rejects past food/beer total of $5001', () => {
    const result = validateAdminPastFoodBeerMulti(
      foodRaw(5001, [{ method: 'cash', amount: 5001 }]),
      STAFF,
      CATALOG
    );
    expect(result.valid).toBe(false);
  });

  it('accepts past food/beer split payments totaling $5000', () => {
    const result = validateAdminPastFoodBeerMulti(
      foodRaw(5000, [
        { method: 'cash', amount: 1500 },
        { method: 'paypal', amount: 2500 },
        { method: 'venmo', amount: 1000 },
      ]),
      STAFF,
      CATALOG
    );
    expect(result.valid).toBe(true);
  });
});
