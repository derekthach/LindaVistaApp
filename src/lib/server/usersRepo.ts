import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { formatEmployeeNameSnapshot } from '@/lib/employeeDisplayName';
import { isGuestEmployeeUsername } from '@/lib/auth/guestEmployee';
import { readLoginSystemUsersJson } from '@/lib/server/readLoginSystemUsersJson';
import type { User, UserRole } from '@/types';

const USERS_COLLECTION = 'users';

export type UserStatus = 'active' | 'inactive';

export interface FirestoreUserDoc {
  id: string;
  fullName: string;
  nickname: string | null;
  username: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  passwordResetRequested: boolean;
  passwordResetRequestedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt: Timestamp | null;
  /**
   * When true, row is excluded from the Admin Employees table (soft remove).
   * Historical check-ins keep `employee_name_snapshot` / ids as stored at check-in time.
   */
  hiddenFromEmployeeList?: boolean;
  /** Set when the account is soft-deleted / removed from the employee list. */
  deactivatedAt?: Timestamp | null;
}

export type PublicUserRow = Omit<FirestoreUserDoc, 'passwordHash'> & {
  /** Row is backed by a real `users/{id}` Firestore document (vs legacy JSON-only virtual row). */
  firestoreBacked: boolean;
};

function db(): Firestore {
  return getAdminDb();
}

/** Document id for `users/{id}` — lowercase trimmed username (matches login lookup). */
export function docIdForUsername(username: string): string {
  return username.trim().toLowerCase();
}

export async function getUserDocByUsername(username: string): Promise<FirestoreUserDoc | null> {
  const id = docIdForUsername(username);
  if (!id) return null;
  const snap = await db().collection(USERS_COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() as Omit<FirestoreUserDoc, 'id'>;
  return { id: snap.id, ...data };
}

export async function firestoreUserDocExists(userId: string): Promise<boolean> {
  const id = userId.trim();
  if (!id) return false;
  const snap = await db().collection(USERS_COLLECTION).doc(id).get();
  return snap.exists;
}

export function userDisplaySnapshot(u: Pick<FirestoreUserDoc, 'fullName' | 'nickname'>): string {
  return formatEmployeeNameSnapshot(u.fullName, u.nickname);
}

export async function updateUserLastLogin(userId: string): Promise<void> {
  const now = Timestamp.now();
  await db().collection(USERS_COLLECTION).doc(userId).update({
    lastLoginAt: now,
    updatedAt: now,
  });
}

export async function requestPasswordResetByUsername(username: string): Promise<boolean> {
  const ref = db().collection(USERS_COLLECTION).doc(docIdForUsername(username));
  const snap = await ref.get();
  if (!snap.exists) return false;
  const data = snap.data() as FirestoreUserDoc;
  if (data.status !== 'active' || data.role !== 'employee') return false;
  const now = Timestamp.now();
  await ref.update({
    passwordResetRequested: true,
    passwordResetRequestedAt: now,
    updatedAt: now,
  });
  return true;
}

function jsonEmployeesByDocId(): Map<string, User> {
  const map = new Map<string, User>();
  for (const u of readLoginSystemUsersJson()) {
    if (u.role !== 'employee' || isGuestEmployeeUsername(u.username)) continue;
    map.set(docIdForUsername(u.username), u);
  }
  return map;
}

/**
 * Firestore `users` is the primary store for Admin → Employees, but login also supports
 * `login-system/users.json`. After a username rename, a stale Firestore doc (e.g. `jary`)
 * can remain while JSON already has `jahaira`. We hide that stale row and align name/username
 * from JSON when the document id matches a JSON employee. JSON-only employees appear so
 * the table matches who can authenticate from the file.
 */
export async function listUsersPublic(): Promise<PublicUserRow[]> {
  const snap = await db().collection(USERS_COLLECTION).orderBy('username').get();
  const jsonById = jsonEmployeesByDocId();
  const jsonDocIds = new Set(jsonById.keys());

  const omitStaleFirestoreJary =
    jsonDocIds.has('jahaira') && !jsonDocIds.has('jary');

  const seen = new Set<string>();
  const rows: PublicUserRow[] = [];

  for (const d of snap.docs) {
    if (omitStaleFirestoreJary && d.id === 'jary') continue;

    const data = d.data() as FirestoreUserDoc;
    const { passwordHash: _ph, ...rest } = data;
    void _ph;
    let row: PublicUserRow = { ...rest, id: d.id, firestoreBacked: true };

    const jsonU = jsonById.get(d.id);
    if (jsonU && jsonU.role === 'employee') {
      const jsonMust = jsonU.mustChangePassword === true;
      const fsMust = row.mustChangePassword === true;
      row = {
        ...row,
        fullName: (jsonU.name?.trim() || jsonU.username).trim(),
        username: docIdForUsername(jsonU.username),
        /** Firestore is auth source when present; merge JSON so missing/stale flags still match `users.json`. */
        mustChangePassword: fsMust || jsonMust,
        firestoreBacked: true,
      };
    }

    rows.push(row);
    seen.add(d.id);
  }

  const now = Timestamp.now();
  for (const [id, jsonU] of jsonById) {
    if (seen.has(id)) continue;
    rows.push({
      id,
      fullName: (jsonU.name?.trim() || jsonU.username).trim(),
      username: docIdForUsername(jsonU.username),
      nickname: null,
      role: 'employee',
      status: 'active',
      mustChangePassword: jsonU.mustChangePassword === true,
      passwordResetRequested: false,
      passwordResetRequestedAt: null,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
      hiddenFromEmployeeList: false,
      deactivatedAt: null,
      firestoreBacked: false,
    });
  }

  rows.sort((a, b) => a.username.localeCompare(b.username, 'en', { sensitivity: 'base' }));
  return rows.filter(
    (r) => r.role === 'employee' && r.hiddenFromEmployeeList !== true
  );
}

export async function countPendingPasswordResets(): Promise<number> {
  const snap = await db().collection(USERS_COLLECTION).where('passwordResetRequested', '==', true).get();
  return snap.size;
}

export async function getUserPublicById(id: string): Promise<PublicUserRow | null> {
  const snap = await db().collection(USERS_COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() as FirestoreUserDoc;
  const { passwordHash: _ph, ...rest } = data;
  void _ph;
  return { ...rest, id: snap.id, firestoreBacked: true };
}

const RESERVED_EMPLOYEE_USERNAMES = new Set(['admin', 'guest']);

export function isReservedEmployeeUsername(username: string): boolean {
  const id = docIdForUsername(username);
  return !id || RESERVED_EMPLOYEE_USERNAMES.has(id);
}

export async function createEmployeeUserDoc(input: {
  fullName: string;
  username: string;
  status: UserStatus;
  passwordHash: string;
}): Promise<void> {
  if (isReservedEmployeeUsername(input.username)) {
    throw new Error('RESERVED_USERNAME');
  }
  const id = docIdForUsername(input.username);
  const ref = db().collection(USERS_COLLECTION).doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    throw new Error('DUPLICATE_USERNAME');
  }
  const now = Timestamp.now();
  const fullName = input.fullName.trim() || id;
  await ref.set({
    id,
    fullName,
    nickname: null,
    username: id,
    passwordHash: input.passwordHash,
    role: 'employee',
    status: input.status,
    mustChangePassword: true,
    passwordResetRequested: false,
    passwordResetRequestedAt: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    hiddenFromEmployeeList: false,
    deactivatedAt: null,
  });
}

export async function updateEmployeeProfileAdmin(
  userId: string,
  updates: { fullName: string; status: UserStatus }
): Promise<void> {
  const ref = db().collection(USERS_COLLECTION).doc(userId.trim());
  const snap = await ref.get();
  if (!snap.exists) throw new Error('NOT_FOUND');
  const data = snap.data() as FirestoreUserDoc;
  if (data.role !== 'employee') throw new Error('NOT_EMPLOYEE');
  const fullName = updates.fullName.trim();
  if (!fullName) throw new Error('EMPTY_NAME');
  const now = Timestamp.now();
  await ref.update({
    fullName,
    status: updates.status,
    updatedAt: now,
  });
}

export async function softDeleteEmployeeFromAdminList(userId: string): Promise<void> {
  const ref = db().collection(USERS_COLLECTION).doc(userId.trim());
  const snap = await ref.get();
  if (!snap.exists) throw new Error('NOT_FOUND');
  const data = snap.data() as FirestoreUserDoc;
  if (data.role !== 'employee') throw new Error('NOT_EMPLOYEE');
  if (isGuestEmployeeUsername(data.username)) {
    throw new Error('GUEST');
  }
  const now = Timestamp.now();
  await ref.update({
    status: 'inactive',
    hiddenFromEmployeeList: true,
    deactivatedAt: now,
    updatedAt: now,
    passwordResetRequested: false,
    passwordResetRequestedAt: null,
  });
}

export async function updatePasswordAndFlags(
  userId: string,
  passwordHash: string,
  flags: {
    mustChangePassword: boolean;
    passwordResetRequested: boolean;
    passwordResetRequestedAt: Timestamp | null;
  }
): Promise<void> {
  await db()
    .collection(USERS_COLLECTION)
    .doc(userId)
    .update({
      passwordHash,
      mustChangePassword: flags.mustChangePassword,
      passwordResetRequested: flags.passwordResetRequested,
      passwordResetRequestedAt: flags.passwordResetRequestedAt,
      updatedAt: Timestamp.now(),
    });
}

/**
 * Creates or updates `users/{userId}` when an admin sets a temporary password and
 * `login-system/users.json` cannot be written (e.g. Vercel serverless read-only FS).
 */
export async function upsertEmployeeAdminPasswordReset(
  userId: string,
  passwordHash: string,
  profile: { fullName: string; username: string; role: UserRole }
): Promise<void> {
  const id = docIdForUsername(userId);
  const ref = db().collection(USERS_COLLECTION).doc(id);
  const snap = await ref.get();
  const now = Timestamp.now();
  const username = docIdForUsername(profile.username);
  if (snap.exists) {
    await ref.update({
      passwordHash,
      mustChangePassword: true,
      passwordResetRequested: false,
      passwordResetRequestedAt: null,
      updatedAt: now,
      fullName: profile.fullName.trim() || username,
      username,
      role: profile.role,
    });
    return;
  }
  await ref.set({
    id,
    fullName: profile.fullName.trim() || username,
    nickname: null,
    username,
    passwordHash,
    role: profile.role,
    status: 'active',
    mustChangePassword: true,
    passwordResetRequested: false,
    passwordResetRequestedAt: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    hiddenFromEmployeeList: false,
    deactivatedAt: null,
  });
}

/**
 * Updates password and clears `mustChangePassword` on an existing `users/{userId}` doc.
 * If the doc is missing and `allowCreateIfMissing` is true, creates a minimal employee doc
 * (used when JSON `users.json` is not writable on serverless but the account still logged in via file).
 */
export async function upsertEmployeePasswordAfterChange(
  userId: string,
  passwordHash: string,
  profile: { fullName: string; role: UserRole },
  options?: { allowCreateIfMissing?: boolean }
): Promise<void> {
  const ref = db().collection(USERS_COLLECTION).doc(userId);
  const snap = await ref.get();
  const now = Timestamp.now();
  if (snap.exists) {
    await ref.update({
      passwordHash,
      mustChangePassword: false,
      updatedAt: now,
    });
    return;
  }
  if (!options?.allowCreateIfMissing) {
    throw new Error(`[auth] Firestore user doc not found: ${userId}`);
  }
  await ref.set({
    id: userId,
    fullName: profile.fullName,
    nickname: null,
    username: userId,
    passwordHash,
    role: profile.role,
    status: 'active',
    mustChangePassword: false,
    passwordResetRequested: false,
    passwordResetRequestedAt: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    hiddenFromEmployeeList: false,
    deactivatedAt: null,
  });
}

export async function setUserPasswordAfterEmployeeChange(
  userId: string,
  passwordHash: string
): Promise<void> {
  await upsertEmployeePasswordAfterChange(
    userId,
    passwordHash,
    { fullName: userId, role: 'employee' },
    { allowCreateIfMissing: false }
  );
}
