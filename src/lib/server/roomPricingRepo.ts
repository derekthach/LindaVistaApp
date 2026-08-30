import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  DEFAULT_ROOM_PRICE_CENTS,
  PRICING_ROOM_IDS,
} from '@/lib/pricing/defaultRoomPrices';
import { completePriceMap, type RoomPriceMap } from '@/lib/pricing/roomPricing';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { isFirestoreUnavailableError, isProduction } from '@/lib/server/firestoreError';

export const ROOM_PRICES_COLLECTION = 'roomPrices';

export type RoomPriceDoc = {
  roomId: string;
  priceCents: number;
  updatedAt: Date | null;
  updatedBy: string | null;
};

function docIdForRoom(roomId: string): string {
  return String(roomId).trim();
}

function parsePriceCents(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

/**
 * Load current room → priceCents map for all pricing rooms.
 * Missing Firestore docs are filled from {@link DEFAULT_ROOM_PRICE_CENTS}
 * and written once (seed) so configuration becomes persistent.
 *
 * Does NOT touch check-ins or historical totals.
 */
export async function getRoomPricingMap(): Promise<RoomPriceMap> {
  try {
    const db = getAdminDb();
    const snapshot = await db.collection(ROOM_PRICES_COLLECTION).get();
    const stored: RoomPriceMap = {};
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const roomId = String(data.roomId ?? doc.id).trim();
      const cents = parsePriceCents(data.priceCents);
      if (!roomId || cents === null) continue;
      stored[roomId] = cents;
    }

    const complete = completePriceMap(stored, { ...DEFAULT_ROOM_PRICE_CENTS });
    await ensureMissingRoomPricesSeeded(stored, complete);
    return complete;
  } catch (err) {
    if (isFirestoreUnavailableError(err)) {
      if (isProduction()) throw err;
      console.warn(
        'Firestore unavailable (getRoomPricingMap), returning defaults:',
        (err as Error).message
      );
      return completePriceMap({}, { ...DEFAULT_ROOM_PRICE_CENTS });
    }
    throw err;
  }
}

/** Create docs for rooms that have never been persisted (idempotent seed). */
async function ensureMissingRoomPricesSeeded(
  stored: RoomPriceMap,
  complete: RoomPriceMap
): Promise<void> {
  const missing = PRICING_ROOM_IDS.map(String).filter((id) => stored[id] === undefined);
  if (missing.length === 0) return;

  const db = getAdminDb();
  const batch = db.batch();
  const now = Timestamp.now();
  for (const roomId of missing) {
    const cents = complete[roomId];
    if (typeof cents !== 'number') continue;
    const ref = db.collection(ROOM_PRICES_COLLECTION).doc(docIdForRoom(roomId));
    batch.set(
      ref,
      {
        roomId,
        priceCents: cents,
        updatedAt: now,
        updatedBy: null,
        seededAt: now,
      },
      { merge: true }
    );
  }
  await batch.commit();
}

export type RoomPriceUpdate = {
  roomId: string;
  priceCents: number;
};

/**
 * Atomically persist multiple room price updates via Firestore writeBatch.
 * Only updates `roomPrices` documents — never check-ins.
 */
export async function saveRoomPricesBatch(
  updates: RoomPriceUpdate[],
  updatedBy: string
): Promise<void> {
  if (updates.length === 0) return;

  const db = getAdminDb();
  const batch = db.batch();
  const now = FieldValue.serverTimestamp();
  const by = updatedBy.trim() || null;

  for (const { roomId, priceCents } of updates) {
    const id = docIdForRoom(roomId);
    if (!id) throw new Error(`Invalid room id: ${roomId}`);
    if (!Number.isInteger(priceCents) || priceCents <= 0) {
      throw new Error(`Invalid priceCents for room ${id}`);
    }
    const ref = db.collection(ROOM_PRICES_COLLECTION).doc(id);
    batch.set(
      ref,
      {
        roomId: id,
        priceCents,
        updatedAt: now,
        updatedBy: by,
      },
      { merge: true }
    );
  }

  await batch.commit();
}
