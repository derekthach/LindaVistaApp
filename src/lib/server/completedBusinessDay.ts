import { calculateDailySummary, isCompleteDailySummary, toDailySummaryDoc, toShiftSummaryDoc } from '@/lib/shifts';
import { HttpError } from '@/lib/server/httpError';
import { saveDailySummary } from '@/lib/server/dailySummariesRepo';
import { generateAndSaveShiftSummariesForBusinessDate } from '@/lib/server/shiftSummariesRepo';
import type { DailySummary, ShiftSummary } from '@/lib/shifts';

export type CompletedBusinessDayResult = {
  businessDate: string;
  shiftSummaries: ShiftSummary[];
  dailySummary: DailySummary;
};

/**
 * Generate + persist all three Shift Summaries for a business date (one day check-in query
 * + one day turnover query), then Daily Summary from those in-memory objects (no raw re-read).
 * Shared by Daily Cron and testable with an explicit historical businessDate.
 */
export async function generateCompletedBusinessDay(
  businessDate: string
): Promise<CompletedBusinessDayResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new HttpError(400, 'INVALID_BUSINESS_DATE');
  }

  const shiftSummaries = await generateAndSaveShiftSummariesForBusinessDate(businessDate);
  if (shiftSummaries.length !== 3) {
    throw new HttpError(500, 'SHIFT_SUMMARY_GENERATION_INCOMPLETE', {
      message: `Expected 3 Shift Summaries for ${businessDate}, got ${shiftSummaries.length}`,
      businessDate,
      count: shiftSummaries.length,
    });
  }

  const dailyResult = calculateDailySummary(shiftSummaries);
  if (!isCompleteDailySummary(dailyResult)) {
    throw new HttpError(500, 'INCOMPLETE_DAILY_SUMMARY', {
      message: `Daily Summary incomplete for ${businessDate}`,
      businessDate,
      missingShifts: dailyResult.missingShifts,
    });
  }

  await saveDailySummary(dailyResult);
  const dailySummary: DailySummary = { ...dailyResult, generatedAt: new Date() };

  return { businessDate, shiftSummaries, dailySummary };
}

export function toCompletedBusinessDayResponse(result: CompletedBusinessDayResult) {
  return {
    success: true as const,
    businessDate: result.businessDate,
    shiftSummariesGenerated: result.shiftSummaries.length,
    dailySummaryGenerated: true as const,
    shiftSummaries: result.shiftSummaries.map(toShiftSummaryDoc),
    dailySummary: toDailySummaryDoc(result.dailySummary),
    totalRevenue: result.dailySummary.totalRevenue,
    totalCars: result.dailySummary.totalCars,
    roomsTurnedOver: result.dailySummary.roomsTurnedOver,
  };
}
