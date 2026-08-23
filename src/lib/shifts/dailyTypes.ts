import type { ShiftId } from './definitions';
import { SHIFT_TIMEZONE } from './definitions';
import { shiftSummaryDocId } from './types';

/**
 * Aggregated metrics for one Puerto Rico business date.
 * Persist shape: dailySummaries/{businessDate}
 */
export type DailySummary = {
  businessDate: string;
  totalRevenue: number;
  totalCars: number;
  roomsTurnedOver: number;
  timezone: typeof SHIFT_TIMEZONE;
  status: 'complete';
  shiftSummaryIds: {
    overnight: string;
    day: string;
    evening: string;
  };
  generatedAt?: Date;
};

/** Incomplete — one or more Shift Summaries missing; totals are not claimed. */
export type IncompleteDailySummary = {
  businessDate: string | null;
  status: 'incomplete';
  missingShifts: ShiftId[];
  timezone: typeof SHIFT_TIMEZONE;
};

export type DailySummaryResult = DailySummary | IncompleteDailySummary;

export type DailySummaryDoc = {
  businessDate: string;
  totalRevenue: number;
  totalCars: number;
  roomsTurnedOver: number;
  timezone: typeof SHIFT_TIMEZONE;
  status: 'complete';
  shiftSummaryIds: {
    overnight: string;
    day: string;
    evening: string;
  };
  generatedAt?: string;
};

export function dailySummaryDocId(businessDate: string): string {
  return businessDate;
}

export function buildShiftSummaryIds(businessDate: string): DailySummary['shiftSummaryIds'] {
  return {
    overnight: shiftSummaryDocId(businessDate, 'overnight'),
    day: shiftSummaryDocId(businessDate, 'day'),
    evening: shiftSummaryDocId(businessDate, 'evening'),
  };
}

export function toDailySummaryDoc(summary: DailySummary): DailySummaryDoc {
  return {
    businessDate: summary.businessDate,
    totalRevenue: summary.totalRevenue,
    totalCars: summary.totalCars,
    roomsTurnedOver: summary.roomsTurnedOver,
    timezone: summary.timezone,
    status: 'complete',
    shiftSummaryIds: summary.shiftSummaryIds,
    ...(summary.generatedAt ? { generatedAt: summary.generatedAt.toISOString() } : {}),
  };
}
