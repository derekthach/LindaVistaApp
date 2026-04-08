import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { findDuplicateActiveRoomGroups } from '@/lib/server/activeRoomStayDedupe';

const CHECKINS_COLLECTION = 'checkins';

/**
 * Read-only audit: active room stays where more than one Firestore document maps to the same room.
 * Safe to call from an admin script or one-off route; does not modify data.
 */
export async function auditDuplicateActiveRoomStays(): Promise<
  { roomKey: string; docIds: string[] }[]
> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(CHECKINS_COLLECTION)
    .where('checkInType', '==', 'room')
    .where('isCheckedOut', '==', false)
    .get();
  return findDuplicateActiveRoomGroups(snapshot.docs);
}
