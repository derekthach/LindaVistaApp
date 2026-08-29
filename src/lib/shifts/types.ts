import type { ShiftId } from './definitions';
import { SHIFT_TIMEZONE } from './definitions';

export type { ShiftId };

/**
 * Computed shift summary — independent of React and of whether the doc is persisted.
 * Persist shape: shiftSummaries/{businessDate}_{shift}
 *
 * Revenue type breakdown uses the same `totalsToCents` rules as View Check-ins (integer cents).
 */
export type ShiftSummary = {
  businessDate: string;
  shift: ShiftId;
  shiftStart: Date;
  shiftEnd: Date;
  /** Dollar total — derived from cents (`(room+food+beer)/100`). Kept for SMS / legacy readers. */
  totalRevenue: number;
  /** Integer cents — Room / Food / Beer attribution (View Check-ins semantics). */
  roomCents: number;
  foodCents: number;
  beerCents: number;
  totalCars: number;
  roomsTurnedOver: number;
  timezone: typeof SHIFT_TIMEZONE;
  /** Set only when loaded from / written to Firestore. */
  generatedAt?: Date;
};

/** Serializable form for Firestore / API responses. */
export type ShiftSummaryDoc = {
  businessDate: string;
  shift: ShiftId;
  shiftStart: string;
  shiftEnd: string;
  totalRevenue: number;
  roomCents: number;
  foodCents: number;
  beerCents: number;
  totalCars: number;
  roomsTurnedOver: number;
  timezone: typeof SHIFT_TIMEZONE;
  generatedAt?: string;
};

/**
 * One completed room turnover candidate (same stay / check-in doc).
 * Cleaning completion time attributes the turnover to a shift.
 */
export type RoomTurnoverRecord = {
  /** Firestore check-in doc id (stay id). */
  id: string;
  /** When guest checkout was recorded. */
  checkedOutAt: Date;
  /** When room was marked cleaned / ready. */
  cleanedAt: Date;
};

export function shiftSummaryDocId(businessDate: string, shift: ShiftId): string {
  return `${businessDate}_${shift}`;
}

export function toShiftSummaryDoc(summary: ShiftSummary): ShiftSummaryDoc {
  return {
    businessDate: summary.businessDate,
    shift: summary.shift,
    shiftStart: summary.shiftStart.toISOString(),
    shiftEnd: summary.shiftEnd.toISOString(),
    totalRevenue: summary.totalRevenue,
    roomCents: summary.roomCents,
    foodCents: summary.foodCents,
    beerCents: summary.beerCents,
    totalCars: summary.totalCars,
    roomsTurnedOver: summary.roomsTurnedOver,
    timezone: summary.timezone,
    ...(summary.generatedAt ? { generatedAt: summary.generatedAt.toISOString() } : {}),
  };
}
