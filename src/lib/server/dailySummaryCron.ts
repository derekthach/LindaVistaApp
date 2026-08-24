import { DateTime } from 'luxon';
import { HttpError } from '@/lib/server/httpError';
import { logError, logInfo } from '@/lib/server/log';
import { getPreviousPuertoRicoBusinessDate } from '@/lib/shifts/cronTarget';
import {
  generateCompletedBusinessDay,
  toCompletedBusinessDayResponse,
} from '@/lib/server/completedBusinessDay';
import { formatDailyManagementMessage } from '@/lib/shifts/formatDailyManagementMessage';
import { sendDailyManagementMessageToDerek } from '@/lib/server/photon/sendDailyManagementMessage';

/**
 * Once-daily Cron orchestration (~6 AM Puerto Rico).
 * Generates yesterday's three Shift Summaries + Daily Summary,
 * then delivers the management iMessage to Derek only (idempotent).
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

    if (!result.dailySummary) {
      throw new Error('Daily Summary was not generated.');
    }

    const message = formatDailyManagementMessage(result.dailySummary, result.shiftSummaries);
    const delivery = await sendDailyManagementMessageToDerek({
      businessDate,
      message,
    });

    const durationMs = Date.now() - startedAt;

    // Summary stays persisted even when messaging fails. Non-2xx lets Cron retry delivery.
    if (delivery.status === 'failed') {
      logError('daily_summary_cron', {
        event: 'daily_summary_cron',
        phase: 'delivery_failure',
        businessDate,
        status: 'delivery_failure',
        shiftSummariesGenerated: 3,
        dailySummaryGenerated: true,
        deliveryStatus: 'failed',
        durationMs,
        error: delivery.error,
      });
      throw new HttpError(502, 'DAILY_SUMMARY_DELIVERY_FAILED', {
        message: 'Daily Summary persisted but Derek iMessage delivery failed',
        businessDate,
        deliveryError: delivery.error,
      });
    }

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
      deliveryStatus: delivery.status,
      durationMs,
      completedAt: new Date().toISOString(),
    });

    return {
      ...toCompletedBusinessDayResponse(result),
      durationMs,
      delivery: {
        recipientKey: delivery.recipientKey,
        status: delivery.status,
        skipReason: delivery.skipReason,
        durationMs: delivery.durationMs,
      },
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
