/**
 * Deliver a persisted Daily Summary to Derek via Photon.
 * Reads only dailySummaries/{date} + shiftSummaries/{date}_* — no raw operational collections.
 */

import { HttpError } from '@/lib/server/httpError';
import { getPersistedDailySummary } from '@/lib/server/dailySummariesRepo';
import { getPersistedShiftSummariesForBusinessDate } from '@/lib/server/shiftSummariesRepo';
import { formatDailyManagementMessage } from '@/lib/shifts/formatDailyManagementMessage';
import { formatMissingShiftSummariesError } from '@/lib/shifts';
import {
  sendDailyManagementMessageToDerek,
  type DailyManagementDeliveryResult,
} from '@/lib/server/photon/sendDailyManagementMessage';

export type DeliverPersistedDailySummaryResult = {
  businessDate: string;
  messagePreviewLength: number;
  delivery: DailyManagementDeliveryResult;
};

export async function deliverPersistedDailySummaryToDerek(
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
  const delivery = await sendDailyManagementMessageToDerek({ businessDate, message });

  return {
    businessDate,
    messagePreviewLength: message.length,
    delivery,
  };
}
