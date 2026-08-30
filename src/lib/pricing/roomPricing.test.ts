import { describe, expect, it } from 'vitest';
import {
  assertDefaultRoomPricesCoverCatalog,
  DEFAULT_ROOM_PRICE_CENTS,
  PRICING_ROOM_IDS,
} from '@/lib/pricing/defaultRoomPrices';
import {
  applyGroupPriceDraft,
  applyRoomPriceDraft,
  compareRoomIds,
  completePriceMap,
  formatPriceCents,
  groupRoomsByPrice,
  listPendingChanges,
  mergeEffectivePrices,
  parsePriceInput,
  sortRoomIds,
} from '@/lib/pricing/roomPricing';

describe('defaultRoomPrices', () => {
  it('covers exactly the pricing room catalog with no $33 tier', () => {
    const { missing, extra } = assertDefaultRoomPricesCoverCatalog();
    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
    expect(PRICING_ROOM_IDS).toHaveLength(31);
    expect(Object.values(DEFAULT_ROOM_PRICE_CENTS).includes(3300)).toBe(false);
  });

  it('matches the final seeded rates', () => {
    expect(DEFAULT_ROOM_PRICE_CENTS['40']).toBe(8000);
    for (const id of ['1', '2', '3', '38']) {
      expect(DEFAULT_ROOM_PRICE_CENTS[id]).toBe(6500);
    }
    for (const id of ['41', '42', '43', '44', '45', '46', '47', '48']) {
      expect(DEFAULT_ROOM_PRICE_CENTS[id]).toBe(5000);
    }
    for (const id of ['14A', '14B', '15A', '15B']) {
      expect(DEFAULT_ROOM_PRICE_CENTS[id]).toBe(4300);
    }
    for (const id of ['16', '17', '18', '19', '20', '21']) {
      expect(DEFAULT_ROOM_PRICE_CENTS[id]).toBe(3500);
    }
    for (const id of ['22', '23', '24', '25', '26', '27', '28', '29']) {
      expect(DEFAULT_ROOM_PRICE_CENTS[id]).toBe(2800);
    }
  });
});

describe('groupRoomsByPrice', () => {
  it('groups highest to lowest with natural room order', () => {
    const groups = groupRoomsByPrice({ ...DEFAULT_ROOM_PRICE_CENTS });
    expect(groups.map((g) => g.priceCents)).toEqual([8000, 6500, 5000, 4300, 3500, 2800]);
    expect(groups[0].roomIds).toEqual(['40']);
    expect(groups[1].roomIds).toEqual(['1', '2', '3', '38']);
    expect(groups[2].roomIds).toEqual(['41', '42', '43', '44', '45', '46', '47', '48']);
    expect(groups[3].roomIds).toEqual(['14A', '14B', '15A', '15B']);
  });

  it('regroups after an individual price change', () => {
    const prices = completePriceMap({}, { ...DEFAULT_ROOM_PRICE_CENTS });
    prices['41'] = 6000;
    const groups = groupRoomsByPrice(prices);
    expect(groups.find((g) => g.priceCents === 6000)?.roomIds).toEqual(['41']);
    expect(groups.find((g) => g.priceCents === 5000)?.roomIds).toEqual([
      '42',
      '43',
      '44',
      '45',
      '46',
      '47',
      '48',
    ]);
  });
});

describe('sortRoomIds / compareRoomIds', () => {
  it('uses natural order not lexicographic', () => {
    expect(sortRoomIds(['14A', '2', '1', '3', '14B'])).toEqual(['1', '2', '3', '14A', '14B']);
    expect(compareRoomIds('2', '14A')).toBeLessThan(0);
  });
});

describe('draft group + individual interaction', () => {
  const persisted = completePriceMap({}, { ...DEFAULT_ROOM_PRICE_CENTS });

  it('group change drafts all rooms in that price', () => {
    const draft = applyGroupPriceDraft(persisted, {}, 4300, 4500);
    expect(listPendingChanges(persisted, draft)).toEqual([
      { roomId: '14A', fromCents: 4300, toCents: 4500 },
      { roomId: '14B', fromCents: 4300, toCents: 4500 },
      { roomId: '15A', fromCents: 4300, toCents: 4500 },
      { roomId: '15B', fromCents: 4300, toCents: 4500 },
    ]);
  });

  it('individual override wins after group change', () => {
    let draft = applyGroupPriceDraft(persisted, {}, 5000, 5500);
    draft = applyRoomPriceDraft(persisted, draft, '41', 6000);
    const pending = listPendingChanges(persisted, draft);
    expect(pending.find((c) => c.roomId === '41')).toEqual({
      roomId: '41',
      fromCents: 5000,
      toCents: 6000,
    });
    for (const id of ['42', '43', '44', '45', '46', '47', '48']) {
      expect(pending.find((c) => c.roomId === id)).toEqual({
        roomId: id,
        fromCents: 5000,
        toCents: 5500,
      });
    }
  });

  it('mergeEffectivePrices prefers draft', () => {
    const effective = mergeEffectivePrices(persisted, { '41': 6000 });
    expect(effective['41']).toBe(6000);
    expect(effective['42']).toBe(5000);
  });

  it('clearing draft when value matches persisted', () => {
    const draft = applyRoomPriceDraft(persisted, { '41': 6000 }, '41', 5000);
    expect(draft['41']).toBeUndefined();
  });
});

describe('parsePriceInput', () => {
  it('accepts valid prices', () => {
    expect(parsePriceInput('50')).toEqual({ ok: true, cents: 5000 });
    expect(parsePriceInput('50.50')).toEqual({ ok: true, cents: 5050 });
    expect(parsePriceInput('$65.00')).toEqual({ ok: true, cents: 6500 });
  });

  it('rejects invalid prices', () => {
    expect(parsePriceInput('').ok).toBe(false);
    expect(parsePriceInput('0').ok).toBe(false);
    expect(parsePriceInput('-5').ok).toBe(false);
    expect(parsePriceInput('50.555').ok).toBe(false);
    expect(parsePriceInput('abc').ok).toBe(false);
  });
});

describe('formatPriceCents', () => {
  it('formats with two decimals', () => {
    expect(formatPriceCents(8000)).toBe('$80.00');
    expect(formatPriceCents(4300)).toBe('$43.00');
  });
});
