import type { ShiftId } from './definitions';
import { SHIFT_TIMEZONE } from './definitions';
import { shiftSummaryDocId } from './types';
import type { SectionTotals } from '@/lib/checkins/sectioning';

/**
 * Aggregated metrics for one Puerto Rico business date.
 * Persist shape: dailySummaries/{businessDate}
 *
 * `viewCheckinsSections` uses View Check-ins closed time buckets (buildSectionedData),
 * so Admin multi-day overview matches the single-day table exactly.
 */
export type DailySummary = {
  businessDate: string;
  totalRevenue: number;
  roomCents: number;
  foodCents: number;
  beerCents: number;
  totalCars: number;
  roomsTurnedOver: number;
  /** Number of check-in documents on this business date (0 = empty day). */
  checkinCount: number;
  /**
   * Three View Check-ins section totals (overnight / day / evening display buckets).
   * Required for multi-day summary-first overview without raw check-in reads.
   */
  viewCheckinsSections: [SectionTotals, SectionTotals, SectionTotals];
  viewCheckinsDayTotals: SectionTotals;
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
  roomCents: number;
  foodCents: number;
  beerCents: number;
  totalCars: number;
  roomsTurnedOver: number;
  checkinCount: number;
  viewCheckinsSections: [SectionTotals, SectionTotals, SectionTotals];
  viewCheckinsDayTotals: SectionTotals;
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
    roomCents: summary.roomCents,
    foodCents: summary.foodCents,
    beerCents: summary.beerCents,
    totalCars: summary.totalCars,
    roomsTurnedOver: summary.roomsTurnedOver,
    checkinCount: summary.checkinCount,
    viewCheckinsSections: summary.viewCheckinsSections,
    viewCheckinsDayTotals: summary.viewCheckinsDayTotals,
    timezone: summary.timezone,
    status: 'complete',
    shiftSummaryIds: summary.shiftSummaryIds,
    ...(summary.generatedAt ? { generatedAt: summary.generatedAt.toISOString() } : {}),
  };
}

/** True when the persisted daily doc includes View Check-ins breakdown fields. */
export function dailySummaryHasViewCheckinsBreakdown(
  data: Partial<DailySummary> | Record<string, unknown> | null | undefined
): boolean {
  if (!data || typeof data !== 'object') return false;
  const sections = (data as DailySummary).viewCheckinsSections;
  const day = (data as DailySummary).viewCheckinsDayTotals;
  return (
    typeof (data as DailySummary).roomCents === 'number' &&
    typeof (data as DailySummary).foodCents === 'number' &&
    typeof (data as DailySummary).beerCents === 'number' &&
    typeof (data as DailySummary).checkinCount === 'number' &&
    Array.isArray(sections) &&
    sections.length === 3 &&
    day != null &&
    typeof day.totalCents === 'number'
  );
}
