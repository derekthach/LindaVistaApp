/**
 * Deliver a persisted Daily Summary to all active management recipients via Photon.
 * Reads only dailySummaries/{date} + shiftSummaries/{date}_* — no raw operational collections.
 * Formats the message once; each recipient has independent delivery state.
 */

import { HttpError } from '@/lib/server/httpError';
import { getPersistedDailySummary } from '@/lib/server/dailySummariesRepo';
import { getPersistedShiftSummariesForBusinessDate } from '@/lib/server/shiftSummariesRepo';
import { formatDailyManagementMessage } from '@/lib/shifts/formatDailyManagementMessage';
import { formatMissingShiftSummariesError } from '@/lib/shifts';
import {
  sendDailyManagementMessagesToActiveRecipients,
  type DailyManagementDeliveryResult,
} from '@/lib/server/photon/sendDailyManagementMessage';

export type DeliverPersistedDailySummaryResult = {
  businessDate: string;
  messagePreviewLength: number;
  deliveries: DailyManagementDeliveryResult[];
};

export async function deliverPersistedDailySummaryToActiveRecipients(
  businessDate: string
): Promise<DeliverPersistedDailySummaryResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new HttpError(400, 'INVALID_BUSINESS_DATE');
  }

  const dailySummary = await getPersistedDailySummary(businessDate);
  if (!dailySummary) {
    throw new HttpError(404, 'DAILY_SUMMARY_NOT_FOUND', {
      message: `No persisted Daily Summary for ${businessDate}`,
      businessDate,
    });
  }

  const { summaries, missingShifts } = await getPersistedShiftSummariesForBusinessDate(businessDate);
  if (missingShifts.length > 0) {
    throw new HttpError(409, 'MISSING_SHIFT_SUMMARIES', {
      message: formatMissingShiftSummariesError(businessDate, missingShifts),
      businessDate,
      missingShifts,
    });
  }

  const message = formatDailyManagementMessage(dailySummary, summaries);
  const deliveries = await sendDailyManagementMessagesToActiveRecipients({
    businessDate,
    message,
  });

  return {
    businessDate,
    messagePreviewLength: message.length,
    deliveries,
  };
}

/** @deprecated Prefer deliverPersistedDailySummaryToActiveRecipients */
export async function deliverPersistedDailySummaryToDerek(businessDate: string) {
  const result = await deliverPersistedDailySummaryToActiveRecipients(businessDate);
  const derek = result.deliveries.find((d) => d.recipientKey === 'derek');
  return {
    businessDate: result.businessDate,
    messagePreviewLength: result.messagePreviewLength,
    delivery: derek ?? result.deliveries[0]!,
    deliveries: result.deliveries,
  };
}
