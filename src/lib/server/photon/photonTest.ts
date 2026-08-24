/**
 * Manual Photon connectivity test — Derek only.
 * Does not touch Daily Summary docs or delivery state.
 */

import { HttpError } from '@/lib/server/httpError';
import { logError, logInfo } from '@/lib/server/log';
import { getActiveRecipientPhone } from '@/lib/server/photon/recipients';
import { sendPhotonIMessageDm } from '@/lib/server/photon/sendIMessage';

export const PHOTON_CONNECTIVITY_TEST_MESSAGE =
  'Linda Vista Photon test — iMessage delivery is working.';

export type PhotonTestResult = {
  recipientKey: 'derek';
  status: 'sent' | 'failed';
  messageId?: string | null;
  durationMs: number;
  error?: string;
};

export async function sendPhotonConnectivityTestToDerek(): Promise<PhotonTestResult> {
  const started = Date.now();
  const recipientKey = 'derek' as const;
  const phone = getActiveRecipientPhone(recipientKey);
  if (!phone) {
    const err = new HttpError(500, 'DAILY_SUMMARY_DEREK_PHONE_MISSING', {
      message: 'DAILY_SUMMARY_DEREK_PHONE is not configured',
    });
    logError('photon_test', {
      event: 'photon_test',
      recipientKey,
      status: 'failed',
      durationMs: Date.now() - started,
      error: err.code,
    });
    throw err;
  }

  try {
    const sendResult = await sendPhotonIMessageDm({
      phone,
      message: PHOTON_CONNECTIVITY_TEST_MESSAGE,
    });
    const result: PhotonTestResult = {
      recipientKey,
      status: 'sent',
      messageId: sendResult.messageId,
      durationMs: Date.now() - started,
    };
    logInfo('photon_test', {
      event: 'photon_test',
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
    const result: PhotonTestResult = {
      recipientKey,
      status: 'failed',
      durationMs: Date.now() - started,
      error: errorMessage.slice(0, 200),
    };
    logError('photon_test', {
      event: 'photon_test',
      recipientKey,
      status: 'failed',
      durationMs: result.durationMs,
      error: result.error,
    });
    throw err instanceof HttpError
      ? err
      : new HttpError(500, 'PHOTON_TEST_FAILED', { message: result.error });
  }
}
