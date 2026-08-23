import { SHIFT_IDS, SHIFT_TIMEZONE, getShiftDisplayLabel, type ShiftId } from './definitions';
import {
  buildShiftSummaryIds,
  type DailySummary,
  type DailySummaryResult,
  type IncompleteDailySummary,
} from './dailyTypes';
import type { ShiftSummary } from './types';
import { sumShiftMetrics } from './calculateShiftSummary';

/**
 * Aggregate three Shift Summaries into one Daily Summary.
 * Pure — no React, no Firestore. Does not treat missing shifts as zeros.
 */
export function calculateDailySummary(shiftSummaries: ShiftSummary[]): DailySummaryResult {
  const byShift = new Map<ShiftId, ShiftSummary>();
  for (const s of shiftSummaries) {
    if (!s || !SHIFT_IDS.includes(s.shift)) continue;
    byShift.set(s.shift, s);
  }

  const missingShifts = SHIFT_IDS.filter((id) => !byShift.has(id));
  const present = SHIFT_IDS.map((id) => byShift.get(id)).filter(Boolean) as ShiftSummary[];
  const businessDates = [...new Set(present.map((s) => s.businessDate).filter(Boolean))];

  if (missingShifts.length > 0) {
    return incompleteResult(
      businessDates.length === 1 ? businessDates[0]! : present[0]?.businessDate ?? null,
      missingShifts
    );
  }

  if (businessDates.length !== 1) {
    return incompleteResult(null, [...SHIFT_IDS]);
  }

  const businessDate = businessDates[0]!;
  const ordered = SHIFT_IDS.map((id) => byShift.get(id)!);
  const totals = sumShiftMetrics(ordered);

  const summary: DailySummary = {
    businessDate,
    totalRevenue: totals.totalRevenue,
    totalCars: totals.totalCars,
    roomsTurnedOver: totals.roomsTurnedOver,
    timezone: SHIFT_TIMEZONE,
    status: 'complete',
    shiftSummaryIds: buildShiftSummaryIds(businessDate),
  };

  return summary;
}

function incompleteResult(
  businessDate: string | null,
  missingShifts: ShiftId[]
): IncompleteDailySummary {
  return {
    businessDate,
    status: 'incomplete',
    missingShifts,
    timezone: SHIFT_TIMEZONE,
  };
}

export function isCompleteDailySummary(result: DailySummaryResult): result is DailySummary {
  return result.status === 'complete';
}

/** Human-readable missing-shift message for Admin / API errors (operating-hours labels). */
export function formatMissingShiftSummariesError(
  businessDate: string | null,
  missingShifts: ShiftId[]
): string {
  const labels = missingShifts.map((s) => getShiftDisplayLabel(s));
  const list =
    labels.length === 1
      ? `${labels[0]} Shift Summary`
      : labels.length === 2
        ? `${labels[0]} and ${labels[1]} Shift Summaries`
        : `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]} Shift Summaries`;
  const datePart = businessDate ? ` for ${businessDate}` : '';
  return `Cannot generate Daily Summary${datePart}: ${list} ${labels.length === 1 ? 'is' : 'are'} missing.`;
}
