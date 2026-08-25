import { DateTime } from 'luxon';
import { HttpError } from '@/lib/server/httpError';
import { logError, logInfo } from '@/lib/server/log';
import { getPreviousPuertoRicoBusinessDate } from '@/lib/shifts/cronTarget';
import {
  generateCompletedBusinessDay,
  toCompletedBusinessDayResponse,
} from '@/lib/server/completedBusinessDay';
import { formatDailyManagementMessage } from '@/lib/shifts/formatDailyManagementMessage';
import {
  hasFailedManagementDelivery,
  sendDailyManagementMessagesToActiveRecipients,
} from '@/lib/server/photon/sendDailyManagementMessage';

/**
 * Once-daily Cron orchestration (~6 AM Puerto Rico).
 * Generates yesterday's three Shift Summaries + Daily Summary,
 * formats the management message once, then delivers independently to each
 * active recipient (Derek + Dad) with per-recipient idempotency.
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
    const deliveries = await sendDailyManagementMessagesToActiveRecipients({
      businessDate,
      message,
    });

    const durationMs = Date.now() - startedAt;
    const deliverySummary = deliveries.map((d) => ({
      recipientKey: d.recipientKey,
      status: d.status,
      skipReason: d.skipReason,
      durationMs: d.durationMs,
      ...(d.error ? { error: d.error } : {}),
    }));

    // Summaries stay persisted even when messaging fails. Non-2xx lets Cron retry failed recipients only.
    if (hasFailedManagementDelivery(deliveries)) {
      logError('daily_summary_cron', {
        event: 'daily_summary_cron',
        phase: 'delivery_failure',
        businessDate,
        status: 'delivery_failure',
        shiftSummariesGenerated: 3,
        dailySummaryGenerated: true,
        deliveries: deliverySummary,
        durationMs,
      });
      throw new HttpError(502, 'DAILY_SUMMARY_DELIVERY_FAILED', {
        message: 'Daily Summary persisted but one or more iMessage deliveries failed',
        businessDate,
        deliveries: deliverySummary,
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
      deliveries: deliverySummary,
      durationMs,
      completedAt: new Date().toISOString(),
    });

    return {
      ...toCompletedBusinessDayResponse(result),
      durationMs,
      deliveries: deliverySummary,
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
