/**
 * Idempotent Daily Summary → management iMessage delivery.
 * Active recipients: Derek + Dad (independent idempotency / retry per key).
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
import {
  sendPhotonIMessageDmWithApp,
  withSpectrumApp,
  type PhotonSendResult,
} from '@/lib/server/photon/sendIMessage';
import { appendThoughtOfTheDay, getDailyQuote } from '@/lib/shifts/dailyThoughtQuotes';

export type DailyManagementDeliveryStatus = 'sent' | 'failed' | 'skipped';

export type DailyManagementDeliveryResult = {
  recipientKey: ManagementRecipientKey;
  status: DailyManagementDeliveryStatus;
  skipReason?: 'already_sent' | 'in_progress';
  messageId?: string | null;
  durationMs: number;
  error?: string;
};

type SendDmFn = (params: { phone: string; message: string }) => Promise<PhotonSendResult>;

type ClaimedSend = {
  recipientKey: ManagementRecipientKey;
  phone: string;
  started: number;
};

/**
 * Claim delivery for one recipient (no Photon call yet).
 * Returns a ready-to-send slot, a terminal result (skip/fail), or null never.
 */
async function claimManagementRecipient(params: {
  businessDate: string;
  recipientKey: ManagementRecipientKey;
  force?: boolean;
}): Promise<
  | { kind: 'send'; slot: ClaimedSend }
  | { kind: 'done'; result: DailyManagementDeliveryResult }
> {
  const { businessDate, recipientKey, force } = params;
  const started = Date.now();

  const phone = getActiveRecipientPhone(recipientKey);
  if (!phone) {
    const envName = managementRecipientEnvName(recipientKey);
    const result: DailyManagementDeliveryResult = {
      recipientKey,
      status: 'failed',
      durationMs: Date.now() - started,
      error: `${envName}_MISSING`,
    };
    logError('daily_summary_delivery', {
      event: 'daily_summary_delivery',
      businessDate,
      recipientKey,
      status: 'failed',
      durationMs: result.durationMs,
      error: result.error,
    });
    return { kind: 'done', result };
  }

  let claim;
  try {
    claim = await claimRecipientDelivery(businessDate, recipientKey, { force });
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    const result: DailyManagementDeliveryResult = {
      recipientKey,
      status: 'failed',
      durationMs: Date.now() - started,
      error: errMessage.slice(0, 200),
    };
    logError('daily_summary_delivery', {
      event: 'daily_summary_delivery',
      businessDate,
      recipientKey,
      status: 'failed',
      durationMs: result.durationMs,
      error: result.error,
    });
    return { kind: 'done', result };
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
    return { kind: 'done', result };
  }

  return { kind: 'send', slot: { recipientKey, phone, started } };
}

/**
 * Build the final per-recipient body: shared Daily Summary + recipient-specific quote.
 * Quote selection uses businessDate + recipientKey (stable, no phone in selection seed).
 */
function messageForRecipient(baseMessage: string, businessDate: string, recipientKey: ManagementRecipientKey): string {
  const quote = getDailyQuote(businessDate, recipientKey);
  return appendThoughtOfTheDay(baseMessage, quote);
}

async function completeClaimedSend(params: {
  businessDate: string;
  message: string;
  slot: ClaimedSend;
  sendDm: SendDmFn;
}): Promise<DailyManagementDeliveryResult> {
  const { businessDate, message, slot, sendDm } = params;
  const { recipientKey, phone, started } = slot;
  const outboundMessage = messageForRecipient(message, businessDate, recipientKey);

  try {
    const sendResult = await sendDm({ phone, message: outboundMessage });
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
 * Send the already-formatted management message to one recipient
 * (Thought of the Day is appended for that recipient only).
 * Opens its own Spectrum app (for single-recipient helpers / tests).
 */
export async function sendManagementMessageToRecipient(params: {
  businessDate: string;
  message: string;
  recipientKey: ManagementRecipientKey;
  /** Manual retest only — overrides already_sent / in_progress claims. */
  force?: boolean;
}): Promise<DailyManagementDeliveryResult> {
  const claimed = await claimManagementRecipient({
    businessDate: params.businessDate,
    recipientKey: params.recipientKey,
    force: params.force,
  });
  if (claimed.kind === 'done') return claimed.result;

  return withSpectrumApp(async (app) =>
    completeClaimedSend({
      businessDate: params.businessDate,
      message: params.message,
      slot: claimed.slot,
      sendDm: (p) => sendPhotonIMessageDmWithApp(app, p),
    })
  );
}

/**
 * Format metrics once upstream; append a recipient-specific Thought of the Day at send time.
 * One Spectrum app per execution when at least one send is needed;
 * independent idempotency (and quote) per recipient.
 */
export async function sendDailyManagementMessagesToActiveRecipients(params: {
  businessDate: string;
  message: string;
}): Promise<DailyManagementDeliveryResult[]> {
  const resultsByKey = new Map<ManagementRecipientKey, DailyManagementDeliveryResult>();
  const toSend: ClaimedSend[] = [];

  for (const recipientKey of ACTIVE_MANAGEMENT_RECIPIENTS) {
    const claimed = await claimManagementRecipient({
      businessDate: params.businessDate,
      recipientKey,
    });
    if (claimed.kind === 'done') {
      resultsByKey.set(recipientKey, claimed.result);
    } else {
      toSend.push(claimed.slot);
    }
  }

  if (toSend.length > 0) {
    await withSpectrumApp(async (app) => {
      const sendDm: SendDmFn = (p) => sendPhotonIMessageDmWithApp(app, p);
      for (const slot of toSend) {
        const result = await completeClaimedSend({
          businessDate: params.businessDate,
          message: params.message,
          slot,
          sendDm,
        });
        resultsByKey.set(slot.recipientKey, result);
      }
    });
  }

  return ACTIVE_MANAGEMENT_RECIPIENTS.map((key) => {
    const row = resultsByKey.get(key);
    if (!row) {
      return {
        recipientKey: key,
        status: 'failed' as const,
        durationMs: 0,
        error: 'MISSING_DELIVERY_RESULT',
      };
    }
    return row;
  });
}

/** True when at least one active recipient failed (sent/skipped are OK). */
export function hasFailedManagementDelivery(
  results: DailyManagementDeliveryResult[]
): boolean {
  return results.some((r) => r.status === 'failed');
}
