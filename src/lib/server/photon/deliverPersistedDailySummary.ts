/**
 * Deliver a persisted Daily Summary to all active management recipients via Photon.
 * Reads only dailySummaries/{date} + shiftSummaries/{date}_* — no raw check-ins.
 * Formats the message once; each recipient has independent delivery state.
 */

import { HttpError } from '@/lib/server/httpError';
import { getPersistedDailySummary } from '@/lib/server/dailySummariesRepo';
import { getPersistedShiftSummariesForBusinessDate } from '@/lib/server/shiftSummariesRepo';
import { formatDailyManagementMessage } from '@/lib/shifts/formatDailyManagementMessage';
import { formatMissingShiftSummariesError } from '@/lib/shifts';
import {
  sendDailyManagementMessagesToActiveRecipients,
  sendManagementMessageToRecipient,
  type DailyManagementDeliveryResult,
} from '@/lib/server/photon/sendDailyManagementMessage';
import {
  isManagementRecipientKey,
  type ManagementRecipientKey,
} from '@/lib/server/photon/recipients';

export type DeliverPersistedDailySummaryResult = {
  businessDate: string;
  messagePreviewLength: number;
  deliveries: DailyManagementDeliveryResult[];
};

async function loadFormattedPersistedDailySummary(businessDate: string): Promise<{
  businessDate: string;
  message: string;
}> {
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

  return {
    businessDate,
    message: formatDailyManagementMessage(dailySummary, summaries),
  };
}

export async function deliverPersistedDailySummaryToActiveRecipients(
  businessDate: string
): Promise<DeliverPersistedDailySummaryResult> {
  const { message } = await loadFormattedPersistedDailySummary(businessDate);
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

/**
 * Deliver a persisted Daily Summary to one allow-listed recipient only.
 * Optional `force` re-sends even if that recipient was already marked sent.
 */
export async function deliverPersistedDailySummaryToRecipient(
  businessDate: string,
  recipientKey: ManagementRecipientKey,
  options?: { force?: boolean }
): Promise<DeliverPersistedDailySummaryResult> {
  if (!isManagementRecipientKey(recipientKey)) {
    throw new HttpError(400, 'INVALID_PHOTON_TEST_RECIPIENT', {
      message: 'recipient must be derek or dad',
    });
  }

  const { message } = await loadFormattedPersistedDailySummary(businessDate);
  const delivery = await sendManagementMessageToRecipient({
    businessDate,
    message,
    recipientKey,
    force: options?.force,
  });

  return {
    businessDate,
    messagePreviewLength: message.length,
    deliveries: [delivery],
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
