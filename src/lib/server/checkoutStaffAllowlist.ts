import { STAFF_MEMBERS } from '@/lib/checkins/constants';
import { formatEmployeeNameSnapshot } from '@/lib/employeeDisplayName';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import type { FirestoreUserDoc } from '@/lib/server/usersRepo';

const USERS_COLLECTION = 'users';

/**
 * Names allowed for room checkout / cleaning (`cleanedBy`).
 * Unions legacy `STAFF_MEMBERS` (family / historical labels) with every active Firestore employee’s
 * display string (same formatting as login/session `displayName`), so new employees work without
 * editing hardcoded arrays.
 */
export async function getMergedCheckoutStaffDisplayNames(): Promise<string[]> {
  const db = getAdminDb();
  const snap = await db.collection(USERS_COLLECTION).where('status', '==', 'active').get();
  const names = new Set<string>(STAFF_MEMBERS);
  for (const doc of snap.docs) {
    const data = doc.data() as Omit<FirestoreUserDoc, 'id'>;
    if (data.role !== 'employee') continue;
    names.add(formatEmployeeNameSnapshot(data.fullName, data.nickname));
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

export async function buildCheckoutStaffSet(): Promise<Set<string>> {
  const list = await getMergedCheckoutStaffDisplayNames();
  return new Set(list);
}
