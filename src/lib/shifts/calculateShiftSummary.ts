import type { CheckIn } from '@/types';
import { totalsToCents } from '@/lib/checkins/sectioning';
import {
  getShiftIdForTimeHHmm,
  getShiftWindow,
  isInstantInHalfOpenRange,
  type ShiftId,
  SHIFT_TIMEZONE,
} from './definitions';
import type { RoomTurnoverRecord, ShiftSummary } from './types';

export type CalculateShiftSummaryInput = {
  businessDate: string;
  shift: ShiftId;
  /**
   * Check-ins already scoped to (or including) the business date.
   * Revenue and cars use check-in wall time (`time`) with half-open shift buckets.
   * Does not perform Firestore reads.
   */
  checkins: CheckIn[];
  /**
   * Turnover candidates (typically from a cleanedAt / checkedOutAt range query).
   * Attribution uses cleanedAt; requires checkedOutAt <= cleanedAt.
   */
  turnovers?: RoomTurnoverRecord[];
};

/**
 * Pure shift metrics. Reuses Day Summary revenue/cars rules via `totalsToCents`.
 * Safe to call from Admin UI, Cron, or tests — no React, no Firestore.
 */
export function calculateShiftSummary(input: CalculateShiftSummaryInput): ShiftSummary {
  const { businessDate, shift, checkins, turnovers = [] } = input;
  const window = getShiftWindow(businessDate, shift);

  const shiftCheckins = checkins.filter((c) => getShiftIdForTimeHHmm(c.time) === shift);
  const money = totalsToCents(shiftCheckins);

  const roomsTurnedOver = countRoomsTurnedOverInWindow(turnovers, window.shiftStart, window.shiftEnd);

  return {
    businessDate,
    shift,
    shiftStart: window.shiftStart,
    shiftEnd: window.shiftEnd,
    roomCents: money.roomCents,
    foodCents: money.foodCents,
    beerCents: money.beerCents,
    totalRevenue: money.totalCents / 100,
    totalCars: money.carCount,
    roomsTurnedOver,
    timezone: SHIFT_TIMEZONE,
  };
}

/** All three shifts for one business date from the same in-memory datasets. */
export function calculateDayShiftSummaries(
  businessDate: string,
  checkins: CheckIn[],
  turnovers: RoomTurnoverRecord[] = []
): ShiftSummary[] {
  return (['overnight', 'day', 'evening'] as const).map((shift) =>
    calculateShiftSummary({ businessDate, shift, checkins, turnovers })
  );
}

/**
 * A turnover counts when:
 * - cleanedAt is in [shiftStart, shiftEnd)
 * - checkedOutAt is present and checkedOutAt <= cleanedAt
 * - each stay id is counted at most once (duplicate cleaning events for same stay collapse)
 */
export function countRoomsTurnedOverInWindow(
  turnovers: RoomTurnoverRecord[],
  shiftStart: Date,
  shiftEnd: Date
): number {
  const countedStayIds = new Set<string>();
  let count = 0;

  for (const t of turnovers) {
    if (!t?.id || !(t.cleanedAt instanceof Date) || !(t.checkedOutAt instanceof Date)) continue;
    if (Number.isNaN(t.cleanedAt.getTime()) || Number.isNaN(t.checkedOutAt.getTime())) continue;
    if (t.checkedOutAt.getTime() > t.cleanedAt.getTime()) continue;
    if (!isInstantInHalfOpenRange(t.cleanedAt, shiftStart, shiftEnd)) continue;
    if (countedStayIds.has(t.id)) continue;
    countedStayIds.add(t.id);
    count += 1;
  }

  return count;
}

/** Sum of three shift revenues / cars should match day totals when checkins are the full day set. */
export function sumShiftMetrics(summaries: ShiftSummary[]): {
  totalRevenue: number;
  roomCents: number;
  foodCents: number;
  beerCents: number;
  totalCars: number;
  roomsTurnedOver: number;
} {
  const summed = summaries.reduce(
    (acc, s) => ({
      roomCents: acc.roomCents + (s.roomCents ?? 0),
      foodCents: acc.foodCents + (s.foodCents ?? 0),
      beerCents: acc.beerCents + (s.beerCents ?? 0),
      totalCars: acc.totalCars + s.totalCars,
      roomsTurnedOver: acc.roomsTurnedOver + s.roomsTurnedOver,
    }),
    { roomCents: 0, foodCents: 0, beerCents: 0, totalCars: 0, roomsTurnedOver: 0 }
  );
  return {
    ...summed,
    totalRevenue: (summed.roomCents + summed.foodCents + summed.beerCents) / 100,
  };
}
