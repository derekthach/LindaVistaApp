import { DateTime } from 'luxon';
import { HttpError } from '@/lib/server/httpError';
import { logError, logInfo } from '@/lib/server/log';
import { generateAndSaveDailySummaryForBusinessDate } from '@/lib/server/dailySummariesRepo';
import { generateAndSaveShiftSummaryForPeriod } from '@/lib/server/shiftSummariesRepo';
import {
  resolveCompletedShiftCronTarget,
  type CompletedShiftCronTarget,
} from '@/lib/shifts/cronTarget';
import { toDailySummaryDoc, toShiftSummaryDoc, type ShiftId, type ShiftSummary } from '@/lib/shifts';

export type ShiftSummaryCronResult = {
  success: true;
  shift: ShiftId;
  businessDate: string;
  summary: ReturnType<typeof toShiftSummaryDoc>;
  dailySummaryGenerated?: boolean;
  dailySummary?: ReturnType<typeof toDailySummaryDoc>;
  dailySummaryError?: string;
  durationMs: number;
};

/**
 * Orchestrate completed-shift generation for Cron (and tests with an injected `now`).
 * Does not call Admin HTTP routes. Does not send messages.
 */
export async function runCompletedShiftSummaryCron(
  shift: ShiftId,
  now: DateTime = DateTime.now()
): Promise<ShiftSummaryCronResult> {
  const startedAt = Date.now();
  const target: CompletedShiftCronTarget = resolveCompletedShiftCronTarget(shift, now);

  logInfo('shift_summary_cron', {
    event: 'shift_summary_cron',
    phase: 'start',
    shift: target.shift,
    businessDate: target.businessDate,
    startedAt: new Date(startedAt).toISOString(),
  });

  let summary: ShiftSummary;
  try {
    summary = await generateAndSaveShiftSummaryForPeriod({
      businessDate: target.businessDate,
      shift: target.shift,
    });
  } catch (err) {
    logError('shift_summary_cron', {
      event: 'shift_summary_cron',
      phase: 'failure',
      shift: target.shift,
      businessDate: target.businessDate,
      status: 'failure',
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  const result: ShiftSummaryCronResult = {
    success: true,
    shift: target.shift,
    businessDate: target.businessDate,
    summary: toShiftSummaryDoc(summary),
    durationMs: Date.now() - startedAt,
  };

  if (target.shift === 'evening') {
    try {
      const daily = await generateAndSaveDailySummaryForBusinessDate(target.businessDate, {
        evening: summary,
      });
      result.dailySummaryGenerated = true;
      result.dailySummary = toDailySummaryDoc(daily);
    } catch (err) {
      if (err instanceof HttpError && err.code === 'MISSING_SHIFT_SUMMARIES') {
        const message =
          typeof err.details?.message === 'string'
            ? err.details.message
            : 'Daily Summary not generated: one or more Shift Summaries missing.';
        result.dailySummaryGenerated = false;
        result.dailySummaryError = message;
        logInfo('shift_summary_cron', {
          event: 'shift_summary_cron',
          phase: 'daily_incomplete',
          shift: target.shift,
          businessDate: target.businessDate,
          dailySummaryGenerated: false,
          missingShifts: err.details?.missingShifts ?? null,
          durationMs: Date.now() - startedAt,
        });
      } else {
        logError('shift_summary_cron', {
          event: 'shift_summary_cron',
          phase: 'daily_failure',
          shift: target.shift,
          businessDate: target.businessDate,
          dailySummaryGenerated: false,
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - startedAt,
        });
        throw err;
      }
    }
  }

  logInfo('shift_summary_cron', {
    event: 'shift_summary_cron',
    phase: 'success',
    shift: target.shift,
    businessDate: target.businessDate,
    status: 'success',
    revenue: summary.totalRevenue,
    cars: summary.totalCars,
    turnovers: summary.roomsTurnedOver,
    dailySummaryGenerated: result.dailySummaryGenerated ?? null,
    durationMs: Date.now() - startedAt,
    completedAt: new Date().toISOString(),
  });

  result.durationMs = Date.now() - startedAt;
  return result;
}
