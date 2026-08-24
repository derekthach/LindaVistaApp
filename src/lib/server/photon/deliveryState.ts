import { FieldValue, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import { dailySummaryDocId } from '@/lib/shifts';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import type { ManagementRecipientKey } from '@/lib/server/photon/recipients';

const DAILY_SUMMARIES_COLLECTION = 'dailySummaries';

/** Stale "sending" claims older than this may be retried (crash recovery). */
const SENDING_CLAIM_STALE_MS = 10 * 60 * 1000;

export type RecipientDeliveryStatus = 'sent' | 'failed' | 'sending';

export type RecipientDeliveryState = {
  status: RecipientDeliveryStatus;
  sentAt?: Date;
  failedAt?: Date;
  claimedAt?: Date;
  messageId?: string;
  error?: string;
};

export type ClaimDeliveryResult =
  | { action: 'skip'; reason: 'already_sent' | 'in_progress' }
  | { action: 'proceed' };

function deliveryPath(key: ManagementRecipientKey): string {
  return `notificationDelivery.${key}`;
}

function parseDeliveryState(raw: unknown): RecipientDeliveryState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const status = o.status;
  if (status !== 'sent' && status !== 'failed' && status !== 'sending') return null;
  const toDate = (v: unknown): Date | undefined => {
    if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
      return (v as { toDate: () => Date }).toDate();
    }
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
    return undefined;
  };
  return {
    status,
    sentAt: toDate(o.sentAt),
    failedAt: toDate(o.failedAt),
    claimedAt: toDate(o.claimedAt),
    messageId: typeof o.messageId === 'string' ? o.messageId : undefined,
    error: typeof o.error === 'string' ? o.error : undefined,
  };
}

function dailySummaryRef(db: Firestore, businessDate: string): DocumentReference {
  return db.collection(DAILY_SUMMARIES_COLLECTION).doc(dailySummaryDocId(businessDate));
}

export async function getRecipientDeliveryState(
  businessDate: string,
  recipientKey: ManagementRecipientKey
): Promise<RecipientDeliveryState | null> {
  const db = getAdminDb();
  const snap = await dailySummaryRef(db, businessDate).get();
  if (!snap.exists) return null;
  const data = snap.data() as Record<string, unknown>;
  const notificationDelivery = data.notificationDelivery as Record<string, unknown> | undefined;
  return parseDeliveryState(notificationDelivery?.[recipientKey]);
}

/**
 * Atomically claim a delivery attempt so concurrent Cron invocations do not double-send.
 * Skips when already sent, or when another attempt is freshly in progress.
 */
export async function claimRecipientDelivery(
  businessDate: string,
  recipientKey: ManagementRecipientKey
): Promise<ClaimDeliveryResult> {
  const db = getAdminDb();
  const ref = dailySummaryRef(db, businessDate);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new Error(`Daily Summary ${businessDate} not found for delivery claim`);
    }
    const data = snap.data() as Record<string, unknown>;
    const notificationDelivery = (data.notificationDelivery as Record<string, unknown>) ?? {};
    const current = parseDeliveryState(notificationDelivery[recipientKey]);

    if (current?.status === 'sent') {
      return { action: 'skip', reason: 'already_sent' };
    }

    if (current?.status === 'sending' && current.claimedAt) {
      const age = Date.now() - current.claimedAt.getTime();
      if (age >= 0 && age < SENDING_CLAIM_STALE_MS) {
        return { action: 'skip', reason: 'in_progress' };
      }
    }

    tx.set(
      ref,
      {
        notificationDelivery: {
          [recipientKey]: {
            status: 'sending',
            claimedAt: FieldValue.serverTimestamp(),
          },
        },
      },
      { merge: true }
    );
    return { action: 'proceed' };
  });
}

export async function markRecipientDeliverySent(params: {
  businessDate: string;
  recipientKey: ManagementRecipientKey;
  messageId: string | null;
}): Promise<void> {
  const db = getAdminDb();
  await dailySummaryRef(db, params.businessDate).set(
    {
      notificationDelivery: {
        [params.recipientKey]: {
          status: 'sent',
          sentAt: FieldValue.serverTimestamp(),
          messageId: params.messageId,
          error: FieldValue.delete(),
          failedAt: FieldValue.delete(),
          claimedAt: FieldValue.delete(),
        },
      },
    },
    { merge: true }
  );
}

export async function markRecipientDeliveryFailed(params: {
  businessDate: string;
  recipientKey: ManagementRecipientKey;
  errorMessage: string;
}): Promise<void> {
  const db = getAdminDb();
  const safeError = params.errorMessage.slice(0, 500);
  await dailySummaryRef(db, params.businessDate).set(
    {
      notificationDelivery: {
        [params.recipientKey]: {
          status: 'failed',
          failedAt: FieldValue.serverTimestamp(),
          error: safeError,
          claimedAt: FieldValue.delete(),
        },
      },
    },
    { merge: true }
  );
}

/** Exported for tests / debugging path names — not for logging phone numbers. */
export { deliveryPath };
