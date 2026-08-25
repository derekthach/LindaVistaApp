/**
 * Manual Photon connectivity test — allow-listed recipient keys only (derek | dad).
 * Does not touch Daily Summary docs or delivery state.
 */

import { HttpError } from '@/lib/server/httpError';
import { logError, logInfo } from '@/lib/server/log';
import {
  getConfiguredRecipientPhone,
  isManagementRecipientKey,
  managementRecipientEnvName,
  type ManagementRecipientKey,
} from '@/lib/server/photon/recipients';
import { sendPhotonIMessageDm } from '@/lib/server/photon/sendIMessage';

export const PHOTON_CONNECTIVITY_TEST_MESSAGES: Record<ManagementRecipientKey, string> = {
  derek: 'Linda Vista Photon test — iMessage delivery is working.',
  dad: 'Linda Vista Photon test — daily business summaries are now enabled.',
};

export type PhotonTestResult = {
  recipientKey: ManagementRecipientKey;
  status: 'sent' | 'failed';
  messageId?: string | null;
  durationMs: number;
  error?: string;
};

export async function sendPhotonConnectivityTest(
  recipientKey: ManagementRecipientKey
): Promise<PhotonTestResult> {
  if (!isManagementRecipientKey(recipientKey)) {
    throw new HttpError(400, 'INVALID_PHOTON_TEST_RECIPIENT', {
      message: 'recipient must be derek or dad',
    });
  }

  const started = Date.now();
  const phone = getConfiguredRecipientPhone(recipientKey);
  if (!phone) {
    const envName = managementRecipientEnvName(recipientKey);
    const err = new HttpError(500, `${envName}_MISSING`, {
      message: `${envName} is not configured`,
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
      message: PHOTON_CONNECTIVITY_TEST_MESSAGES[recipientKey],
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

/** @deprecated Prefer sendPhotonConnectivityTest('derek') */
export async function sendPhotonConnectivityTestToDerek(): Promise<PhotonTestResult> {
  return sendPhotonConnectivityTest('derek');
}
