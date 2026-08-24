/**
 * Idempotent Daily Summary → management iMessage delivery.
 * Testing phase: ACTIVE_MANAGEMENT_RECIPIENTS is Derek-only (Dad disabled).
 */

import { HttpError } from '@/lib/server/httpError';
import { logError, logInfo } from '@/lib/server/log';
import {
  claimRecipientDelivery,
  markRecipientDeliveryFailed,
  markRecipientDeliverySent,
} from '@/lib/server/photon/deliveryState';
import {
  ACTIVE_MANAGEMENT_RECIPIENTS,
  getActiveRecipientPhone,
  managementRecipientEnvName,
  type ManagementRecipientKey,
} from '@/lib/server/photon/recipients';
import { sendPhotonIMessageDm } from '@/lib/server/photon/sendIMessage';

export type DailyManagementDeliveryStatus = 'sent' | 'failed' | 'skipped';

export type DailyManagementDeliveryResult = {
  recipientKey: ManagementRecipientKey;
  status: DailyManagementDeliveryStatus;
  skipReason?: 'already_sent' | 'in_progress';
  messageId?: string | null;
  durationMs: number;
  error?: string;
};

async function sendDailyManagementMessageToRecipient(params: {
  businessDate: string;
  message: string;
  recipientKey: ManagementRecipientKey;
}): Promise<DailyManagementDeliveryResult> {
  const { businessDate, message, recipientKey } = params;
  const started = Date.now();

  const phone = getActiveRecipientPhone(recipientKey);
  if (!phone) {
    const envName = managementRecipientEnvName(recipientKey);
    const err = new HttpError(500, `${envName}_MISSING`, {
      message: `${envName} is not configured`,
    });
    logError('daily_summary_delivery', {
      event: 'daily_summary_delivery',
      businessDate,
      recipientKey,
      status: 'failed',
      durationMs: Date.now() - started,
      error: err.code,
    });
    throw err;
  }

  let claim;
  try {
    claim = await claimRecipientDelivery(businessDate, recipientKey);
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    logError('daily_summary_delivery', {
      event: 'daily_summary_delivery',
      businessDate,
      recipientKey,
      status: 'failed',
      durationMs: Date.now() - started,
      error: errMessage.slice(0, 200),
    });
    throw err;
  }

  if (claim.action === 'skip') {
    const result: DailyManagementDeliveryResult = {
      recipientKey,
      status: 'skipped',
      skipReason: claim.reason,
      durationMs: Date.now() - started,
    };
    logInfo('daily_summary_delivery', {
      event: 'daily_summary_delivery',
      businessDate,
      recipientKey,
      status: 'skipped',
      skipReason: claim.reason,
      durationMs: result.durationMs,
    });
    return result;
  }

  try {
    const sendResult = await sendPhotonIMessageDm({ phone, message });
    await markRecipientDeliverySent({
      businessDate,
      recipientKey,
      messageId: sendResult.messageId,
    });
    const result: DailyManagementDeliveryResult = {
      recipientKey,
      status: 'sent',
      messageId: sendResult.messageId,
      durationMs: Date.now() - started,
    };
    logInfo('daily_summary_delivery', {
      event: 'daily_summary_delivery',
      businessDate,
      recipientKey,
      status: 'sent',
      durationMs: result.durationMs,
    });
    return result;
  } catch (err) {
    const errorMessage =
      err instanceof HttpError
        ? err.code
        : err instanceof Error
          ? err.message
          : String(err);
    try {
      await markRecipientDeliveryFailed({
        businessDate,
        recipientKey,
        errorMessage,
      });
    } catch {
      /* keep original error */
    }
    const result: DailyManagementDeliveryResult = {
      recipientKey,
      status: 'failed',
      durationMs: Date.now() - started,
      error: errorMessage.slice(0, 200),
    };
    logError('daily_summary_delivery', {
      event: 'daily_summary_delivery',
      businessDate,
      recipientKey,
      status: 'failed',
      durationMs: result.durationMs,
      error: result.error,
    });
    return result;
  }
}

/**
 * Deliver to every *active* management recipient (currently Derek only).
 * Enable Dad later by adding "dad" to ACTIVE_MANAGEMENT_RECIPIENTS — same formatter,
 * Spectrum path, delivery tracking, and retry behavior.
 */
export async function sendDailyManagementMessagesToActiveRecipients(params: {
  businessDate: string;
  message: string;
}): Promise<DailyManagementDeliveryResult[]> {
  const results: DailyManagementDeliveryResult[] = [];
  for (const recipientKey of ACTIVE_MANAGEMENT_RECIPIENTS) {
    results.push(
      await sendDailyManagementMessageToRecipient({
        businessDate: params.businessDate,
        message: params.message,
        recipientKey,
      })
    );
  }
  return results;
}

/** Testing-phase helper: Derek only (same as the sole active recipient). */
export async function sendDailyManagementMessageToDerek(params: {
  businessDate: string;
  message: string;
}): Promise<DailyManagementDeliveryResult> {
  const results = await sendDailyManagementMessagesToActiveRecipients(params);
  const derek = results.find((r) => r.recipientKey === 'derek');
  if (!derek) {
    throw new HttpError(500, 'DEREK_RECIPIENT_DISABLED', {
      message: 'Derek is not in ACTIVE_MANAGEMENT_RECIPIENTS',
    });
  }
  return derek;
}
