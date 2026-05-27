import type { CheckIn } from '@/types';
import { isRoomCheckinRecord } from '@/lib/checkins/roomCheckinRecord';
import {
  PAYMENT_METHODS,
  getPaymentMethodTranslationKey,
  hasStoredPaymentMethodSingle,
  type PaymentMethodValue,
} from '@/lib/checkins/paymentMethods';

/** Parse "HH:mm" to minutes since midnight. Invalid => 0. */
export function timeToMinutes(timeHHmm: string): number {
  const parts = String(timeHHmm).trim().split(':');
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return Math.max(0, Math.min(1439, h * 60 + m));
}

/** Bucket 1: 0..480 (12:00am-8:00am), Bucket 2: 481..960 (8:01am-4:00pm), Bucket 3: 961..1439 (4:01pm-11:59pm). */
export const BUCKET_RANGES: [number, number][] = [
  [0, 480],
  [481, 960],
  [961, 1439],
];

export const SECTION_LABELS = ['12:00am-8:00am', '8:01am-4:00pm', '4:01pm-11:59pm'];

export function getBucketIndex(mins: number): number {
  for (let i = 0; i < BUCKET_RANGES.length; i++) {
    const [lo, hi] = BUCKET_RANGES[i];
    if (mins >= lo && mins <= hi) return i;
  }
  return 2;
}

/**
 * One car per room receipt for section/day totals — uses `isRoomCheckinRecord` (dashboard monthly
 * car_count rules), not license-plate presence (past/admin room rows may omit plate).
 */
export function countsAsCar(checkin: CheckIn): boolean {
  return isRoomCheckinRecord(checkin);
}

/** Single monetary amount for a check-in (already normalized: room cost or food/beer total). */
export function getCheckinAmount(checkin: CheckIn): number {
  const n = Number(checkin.cost);
  return Number.isNaN(n) ? 0 : Math.max(0, n);
}

export type CheckinAmountByType = { room: number; food: number; beer: number };

/** Amount for this check-in attributed to each type (only one is non-zero). */
export function getCheckinAmountByType(checkin: CheckIn): CheckinAmountByType {
  const amount = getCheckinAmount(checkin);
  const t = checkin.checkInType ?? 'room';
  if (t === 'room') return { room: amount, food: 0, beer: 0 };
  if (t === 'food') return { room: 0, food: amount, beer: 0 };
  return { room: 0, food: 0, beer: amount };
}

export type SectionTotals = {
  roomCents: number;
  foodCents: number;
  beerCents: number;
  totalCents: number;
  carCount: number;
};

export type PaymentMethodTotalKey = PaymentMethodValue | 'unspecified';

export interface PaymentMethodTotal {
  method: PaymentMethodTotalKey;
  cents: number;
}

function positiveAmountToCents(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

function getRecordedCheckinRevenueCents(checkin: CheckIn): number {
  if ((checkin.checkInType ?? 'room') === 'room') {
    const roomTotalCents = positiveAmountToCents(checkin.total_collected);
    if (roomTotalCents > 0) return roomTotalCents;
  }
  return positiveAmountToCents(checkin.cost);
}

function getCanonicalPaymentMethod(value: string | undefined | null): PaymentMethodValue | null {
  if (!hasStoredPaymentMethodSingle(value)) return null;
  return getPaymentMethodTranslationKey(String(value));
}

function addPaymentTotal(
  totals: Map<PaymentMethodTotalKey, number>,
  method: PaymentMethodTotalKey,
  cents: number
) {
  if (cents <= 0) return;
  totals.set(method, (totals.get(method) ?? 0) + cents);
}

function addSinglePaymentAmount(
  totals: Map<PaymentMethodTotalKey, number>,
  paymentMethod: string | undefined | null,
  cents: number
) {
  if (cents <= 0) return;
  addPaymentTotal(totals, getCanonicalPaymentMethod(paymentMethod) ?? 'unspecified', cents);
}

export function totalsToCents(checkins: CheckIn[]): SectionTotals {
  let roomCents = 0;
  let foodCents = 0;
  let beerCents = 0;
  let carCount = 0;
  for (const c of checkins) {
    const by = getCheckinAmountByType(c);
    roomCents += Math.round(by.room * 100);
    foodCents += Math.round(by.food * 100);
    beerCents += Math.round(by.beer * 100);
    if (countsAsCar(c)) carCount += 1;
  }
  return {
    roomCents,
    foodCents,
    beerCents,
    totalCents: roomCents + foodCents + beerCents,
    carCount,
  };
}

export function paymentMethodTotalsToCents(checkins: CheckIn[]): PaymentMethodTotal[] {
  const totals = new Map<PaymentMethodTotalKey, number>();

  for (const checkin of checkins) {
    const revenueCents = getRecordedCheckinRevenueCents(checkin);
    if (revenueCents <= 0) continue;

    const checkinType = checkin.checkInType ?? 'room';
    const splits = Array.isArray(checkin.payment_splits) ? checkin.payment_splits : [];

    if (checkinType === 'room' && splits.length > 0) {
      let splitCents = 0;

      for (const split of splits) {
        const cents = positiveAmountToCents(split?.amount);
        if (cents <= 0) continue;
        addPaymentTotal(totals, getCanonicalPaymentMethod(split?.method) ?? 'unspecified', cents);
        splitCents += cents;
      }

      if (splitCents === 0) {
        addSinglePaymentAmount(totals, checkin.payment_method, revenueCents);
        continue;
      }

      if (revenueCents > splitCents) {
        addPaymentTotal(totals, 'unspecified', revenueCents - splitCents);
      }
      continue;
    }

    addSinglePaymentAmount(totals, checkin.payment_method, revenueCents);
  }

  return [...PAYMENT_METHODS, 'unspecified' as const].flatMap((method) => {
    const cents = totals.get(method) ?? 0;
    return cents > 0 ? [{ method, cents }] : [];
  });
}

/** Same sort order as UI table: by time then receipt. */
export function sortCheckinsForSections(checkins: CheckIn[]): CheckIn[] {
  return [...checkins].sort((a, b) => {
    const minsA = timeToMinutes(a.time);
    const minsB = timeToMinutes(b.time);
    if (minsA !== minsB) return minsA - minsB;
    return (a.receipt_number || '').localeCompare(b.receipt_number || '');
  });
}

export interface SectionedData {
  sorted: CheckIn[];
  buckets: CheckIn[][];
  sectionTotals: SectionTotals[];
  dayTotals: SectionTotals;
}

/** Group checkins into time sections and compute totals. Single source of truth for UI and export. */
export function buildSectionedData(checkins: CheckIn[]): SectionedData {
  const sorted = sortCheckinsForSections(checkins);
  const buckets: CheckIn[][] = [[], [], []];
  const sectionTotals: SectionTotals[] = [
    { roomCents: 0, foodCents: 0, beerCents: 0, totalCents: 0, carCount: 0 },
    { roomCents: 0, foodCents: 0, beerCents: 0, totalCents: 0, carCount: 0 },
    { roomCents: 0, foodCents: 0, beerCents: 0, totalCents: 0, carCount: 0 },
  ];
  for (const c of sorted) {
    const mins = timeToMinutes(c.time);
    const idx = getBucketIndex(mins);
    buckets[idx].push(c);
    const t = totalsToCents([c]);
    sectionTotals[idx].roomCents += t.roomCents;
    sectionTotals[idx].foodCents += t.foodCents;
    sectionTotals[idx].beerCents += t.beerCents;
    sectionTotals[idx].totalCents += t.totalCents;
    sectionTotals[idx].carCount += t.carCount;
  }
  const dayTotals: SectionTotals = {
    roomCents: sectionTotals[0].roomCents + sectionTotals[1].roomCents + sectionTotals[2].roomCents,
    foodCents: sectionTotals[0].foodCents + sectionTotals[1].foodCents + sectionTotals[2].foodCents,
    beerCents: sectionTotals[0].beerCents + sectionTotals[1].beerCents + sectionTotals[2].beerCents,
    totalCents: sectionTotals[0].totalCents + sectionTotals[1].totalCents + sectionTotals[2].totalCents,
    carCount: sectionTotals[0].carCount + sectionTotals[1].carCount + sectionTotals[2].carCount,
  };
  return { sorted, buckets, sectionTotals, dayTotals };
}
