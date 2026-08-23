import { DateTime } from 'luxon';
import { logError, logInfo } from '@/lib/server/log';
import { getPreviousPuertoRicoBusinessDate } from '@/lib/shifts/cronTarget';
import {
  generateCompletedBusinessDay,
  toCompletedBusinessDayResponse,
} from '@/lib/server/completedBusinessDay';

/**
 * Once-daily Cron orchestration (~6 AM Puerto Rico).
 * Generates yesterday's three Shift Summaries + Daily Summary.
 */
export async function runDailySummaryCron(now: DateTime = DateTime.now()) {
  const startedAt = Date.now();
  const businessDate = getPreviousPuertoRicoBusinessDate(now);

  logInfo('daily_summary_cron', {
    event: 'daily_summary_cron',
    phase: 'start',
    businessDate,
    startedAt: new Date(startedAt).toISOString(),
  });

  try {
    const result = await generateCompletedBusinessDay(businessDate);
    const durationMs = Date.now() - startedAt;

    logInfo('daily_summary_cron', {
      event: 'daily_summary_cron',
      phase: 'success',
      businessDate,
      status: 'success',
      shiftSummariesGenerated: 3,
      dailySummaryGenerated: true,
      totalRevenue: result.dailySummary.totalRevenue,
      totalCars: result.dailySummary.totalCars,
      roomsTurnedOver: result.dailySummary.roomsTurnedOver,
      durationMs,
      completedAt: new Date().toISOString(),
    });

    return {
      ...toCompletedBusinessDayResponse(result),
      durationMs,
    };
  } catch (err) {
    logError('daily_summary_cron', {
      event: 'daily_summary_cron',
      phase: 'failure',
      businessDate,
      status: 'failure',
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
