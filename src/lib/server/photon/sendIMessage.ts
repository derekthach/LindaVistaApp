/**
 * Server-only Spectrum cloud iMessage send (shared-pool Free/Pro — no dedicated number).
 * Supports a short-lived Spectrum app per send, or reuse one app across recipients.
 */

import { Spectrum } from 'spectrum-ts';
import { imessage } from 'spectrum-ts/providers/imessage';
import { HttpError } from '@/lib/server/httpError';
import { requireSpectrumCredentials } from '@/lib/server/photon/credentials';

export type PhotonSendResult = {
  messageId: string | null;
};

type SpectrumApp = Awaited<ReturnType<typeof Spectrum>>;

async function createSpectrumApp(): Promise<SpectrumApp> {
  const { projectId, projectSecret } = requireSpectrumCredentials();
  return Spectrum({
    projectId,
    projectSecret,
    providers: [imessage.config()],
  });
}

/**
 * Run work against one Spectrum app, always stopping afterward (serverless-safe).
 */
export async function withSpectrumApp<T>(fn: (app: SpectrumApp) => Promise<T>): Promise<T> {
  const app = await createSpectrumApp();
  try {
    return await fn(app);
  } finally {
    try {
      await app.stop();
    } catch {
      /* best-effort shutdown */
    }
  }
}

/**
 * Send one plain-text iMessage DM using an existing Spectrum app (individual DM, not a group).
 * Never logs the phone number.
 */
export async function sendPhotonIMessageDmWithApp(
  app: SpectrumApp,
  params: { phone: string; message: string }
): Promise<PhotonSendResult> {
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

  const im = imessage(app);
  const recipient = await im.user(phone);
  const dm = await im.space.create(recipient);
  const result = await dm.send(message);
  return { messageId: result?.id ?? null };
}

/**
 * Send one plain-text iMessage DM (creates and stops a Spectrum app for this send).
 */
export async function sendPhotonIMessageDm(params: {
  phone: string;
  message: string;
}): Promise<PhotonSendResult> {
  return withSpectrumApp((app) => sendPhotonIMessageDmWithApp(app, params));
}
