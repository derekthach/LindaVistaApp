'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/server/auth/session';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { isValidRoomForNewCheckin } from '@/lib/checkins/rooms';
import { parsePriceInput } from '@/lib/pricing/roomPricing';
import {
  getRoomPricingMap,
  saveRoomPricesBatch,
  type RoomPriceUpdate,
} from '@/lib/server/roomPricingRepo';
import { HttpError } from '@/lib/server/httpError';

export type SaveRoomPricingResult =
  | { ok: true }
  | { ok: false; error: string };

type ChangeInput = {
  roomId: string;
  priceCents?: number;
  /** Dollar string alternative; validated server-side. */
  price?: string;
};

/**
 * Persist pending room price changes (admin only).
 * Configuration only — does not modify check-in documents or historical totals.
 */
export async function saveRoomPricingAction(
  changes: ChangeInput[]
): Promise<SaveRoomPricingResult> {
  const session = await requireAuth('admin');
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof HttpError) {
      return { ok: false, error: 'Unauthorized.' };
    }
    throw e;
  }

  try {
    if (!Array.isArray(changes) || changes.length === 0) {
      return { ok: false, error: 'No pricing changes to save.' };
    }

    const current = await getRoomPricingMap();
    const updates: RoomPriceUpdate[] = [];
    const seen = new Set<string>();

    for (const change of changes) {
      const roomId = String(change?.roomId ?? '').trim();
      if (!roomId || !isValidRoomForNewCheckin(roomId)) {
        return { ok: false, error: `Invalid room: ${roomId || '(empty)'}` };
      }
      if (seen.has(roomId)) {
        return { ok: false, error: `Duplicate room in changes: ${roomId}` };
      }
      seen.add(roomId);

      let priceCents: number | undefined =
        typeof change.priceCents === 'number' ? change.priceCents : undefined;
      if (priceCents === undefined && typeof change.price === 'string') {
        const parsed = parsePriceInput(change.price);
        if (!parsed.ok) {
          return { ok: false, error: `Invalid price for room ${roomId}.` };
        }
        priceCents = parsed.cents;
      }
      if (
        typeof priceCents !== 'number' ||
        !Number.isInteger(priceCents) ||
        priceCents <= 0
      ) {
        return { ok: false, error: `Invalid price for room ${roomId}.` };
      }

      if (current[roomId] === priceCents) continue;
      updates.push({ roomId, priceCents });
    }

    if (updates.length === 0) {
      return { ok: false, error: 'No pricing changes to save.' };
    }

    await saveRoomPricesBatch(updates, session.username ?? 'admin');
    revalidatePath('/admin/pricing');
    return { ok: true };
  } catch (e) {
    console.error('[saveRoomPricingAction]', e);
    return { ok: false, error: 'Could not save room pricing. Please try again.' };
  }
}
