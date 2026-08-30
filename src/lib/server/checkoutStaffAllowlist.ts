import { STAFF_MEMBERS } from '@/lib/checkins/constants';
import { isGuestEmployeeUsername } from '@/lib/auth/guestEmployee';
import { formatEmployeeNameSnapshot } from '@/lib/employeeDisplayName';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import type { FirestoreUserDoc } from '@/lib/server/usersRepo';
import { getUsers } from '@/server/auth/users';

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
    if (data.hiddenFromEmployeeList === true) continue;
    names.add(formatEmployeeNameSnapshot(data.fullName, data.nickname));
  }
  try {
    for (const u of getUsers()) {
      if (u.role !== 'employee') continue;
      if (isGuestEmployeeUsername(u.username)) continue;
      const label = (u.name?.trim() || u.username.trim());
      if (label) names.add(label);
    }
  } catch {
    /* ignore missing/unreadable legacy users.json in odd environments */
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

/**
 * Staff names for View Check-ins Advanced Filters — includes inactive / hidden employees
 * so historical check-ins remain filterable after soft-remove.
 */
export async function getFilterStaffDisplayNames(): Promise<string[]> {
  const db = getAdminDb();
  const snap = await db.collection(USERS_COLLECTION).get();
  const names = new Set<string>(STAFF_MEMBERS);
  for (const doc of snap.docs) {
    const data = doc.data() as Omit<FirestoreUserDoc, 'id'>;
    if (data.role !== 'employee') continue;
    names.add(formatEmployeeNameSnapshot(data.fullName, data.nickname));
  }
  try {
    for (const u of getUsers()) {
      if (u.role !== 'employee') continue;
      if (isGuestEmployeeUsername(u.username)) continue;
      const label = (u.name?.trim() || u.username.trim());
      if (label) names.add(label);
    }
  } catch {
    /* ignore */
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

export async function buildCheckoutStaffSet(): Promise<Set<string>> {
  const list = await getMergedCheckoutStaffDisplayNames();
  return new Set(list);
}
