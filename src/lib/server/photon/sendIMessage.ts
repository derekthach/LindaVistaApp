/**
 * Server-only Spectrum cloud iMessage send (shared-pool Free/Pro — no dedicated number).
 * Creates a short-lived Spectrum app per send, then stops it (serverless-safe).
 */

import { Spectrum } from 'spectrum-ts';
import { imessage } from 'spectrum-ts/providers/imessage';
import { HttpError } from '@/lib/server/httpError';
import { requireSpectrumCredentials } from '@/lib/server/photon/credentials';

export type PhotonSendResult = {
  messageId: string | null;
};

/**
 * Send one plain-text iMessage DM to the given E.164 (or address) phone.
 * Caller must already have decided which recipient is allowed.
 * Never logs the phone number.
 */
export async function sendPhotonIMessageDm(params: {
  phone: string;
  message: string;
}): Promise<PhotonSendResult> {
  const phone = params.phone.trim();
  const message = params.message;
  if (!phone) {
    throw new HttpError(500, 'PHOTON_RECIPIENT_PHONE_MISSING', {
      message: 'Recipient phone is empty',
    });
  }
  if (!message.trim()) {
    throw new HttpError(500, 'PHOTON_MESSAGE_EMPTY', {
      message: 'Message body is empty',
    });
  }

  const { projectId, projectSecret } = requireSpectrumCredentials();

  const app = await Spectrum({
    projectId,
    projectSecret,
    providers: [imessage.config()],
  });

  try {
    const im = imessage(app);
    const recipient = await im.user(phone);
    const dm = await im.space.create(recipient);
    const result = await dm.send(message);
    return { messageId: result?.id ?? null };
  } finally {
    try {
      await app.stop();
    } catch {
      /* best-effort shutdown */
    }
  }
}
