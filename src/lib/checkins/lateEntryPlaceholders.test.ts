import { describe, expect, it } from 'vitest';
import type { CheckIn } from '@/types';
import {
  ADMIN_LATE_BEER_ITEMS,
  ADMIN_LATE_FOOD_ITEMS,
  BEER_ITEMS,
  FOOD_ITEMS,
  extendCatalogWithStoredItems,
} from './items';
import {
  ADMIN_LATE_ROOM_OPTIONS,
  isValidAdminLateRoomId,
  parseAdminLateRoomOptionValue,
} from './rooms';
import { countsAsCar, paymentMethodTotalsToCents, totalsToCents } from './sectioning';
import { isActiveOccupiedRoom, isActiveOccupiedRoomDoc, normalizeOccupiedRoomKey } from './roomOccupancy';

function baseRoom(overrides: Partial<CheckIn> = {}): CheckIn {
  return {
    receipt_number: '1',
    date: '2026-05-26',
    time: '10:15',
    checkInType: 'room',
    room_id: 0,
    cost: 45,
    total_collected: 45,
    payment_method: 'cash',
    payment_splits: [{ method: 'cash', amount: 45 }],
    staff_name: 'Admin',
    car_plate: '',
    car_make: '',
    car_color: 'black',
    ...overrides,
  };
}

describe('admin late-entry placeholder catalogs', () => {
  it('keeps Room 0 and General limited to the admin late-entry option lists', () => {
    expect(ADMIN_LATE_ROOM_OPTIONS[0]).toBe(0);
    expect(isValidAdminLateRoomId(0)).toBe(true);
    expect(parseAdminLateRoomOptionValue('0')).toBe(0);

    expect(FOOD_ITEMS.some((item) => item.id === 'General')).toBe(false);
    expect(BEER_ITEMS.some((item) => item.id === 'General')).toBe(false);
    expect(ADMIN_LATE_FOOD_ITEMS[0]?.id).toBe('General');
    expect(ADMIN_LATE_BEER_ITEMS[0]?.id).toBe('General');
  });

  it('can extend an edit catalog with stored placeholder items', () => {
    const extended = extendCatalogWithStoredItems(FOOD_ITEMS, [{ itemId: 'General', itemLabel: 'General' }]);
    expect(extended[0]).toEqual({
      id: 'General',
      label: { en: 'General', es: 'General' },
    });
  });
});

describe('Room 0 late-entry behavior', () => {
  it('still contributes to totals and payment method reporting', () => {
    const checkin = baseRoom();

    expect(countsAsCar(checkin)).toBe(true);
    expect(totalsToCents([checkin])).toMatchObject({
      roomCents: 4500,
      totalCents: 4500,
      carCount: 1,
    });
    expect(paymentMethodTotalsToCents([checkin])).toEqual([{ method: 'cash', cents: 4500 }]);
  });

  it('is excluded from active occupied room logic', () => {
    const checkin = baseRoom({ is_checked_out: false });

    expect(normalizeOccupiedRoomKey(0)).toBe('');
    expect(isActiveOccupiedRoom(checkin)).toBe(false);
    expect(
      isActiveOccupiedRoomDoc({
        checkInType: 'room',
        roomId: 0,
        isCheckedOut: false,
      })
    ).toBe(false);
  });
});
