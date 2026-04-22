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
}

export type PublicUserRow = Omit<FirestoreUserDoc, 'passwordHash'>;

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
    let row: PublicUserRow = { ...rest, id: d.id } as PublicUserRow;

    const jsonU = jsonById.get(d.id);
    if (jsonU && jsonU.role === 'employee') {
      row = {
        ...row,
        fullName: (jsonU.name?.trim() || jsonU.username).trim(),
        username: docIdForUsername(jsonU.username),
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
    });
  }

  rows.sort((a, b) => a.username.localeCompare(b.username, 'en', { sensitivity: 'base' }));
  return rows;
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
  return { ...rest, id: snap.id } as PublicUserRow;
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
