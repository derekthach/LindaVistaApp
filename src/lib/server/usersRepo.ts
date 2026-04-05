import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { formatEmployeeNameSnapshot } from '@/lib/employeeDisplayName';
import type { UserRole } from '@/types';

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

function docIdForUsername(username: string): string {
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

export async function listUsersPublic(): Promise<PublicUserRow[]> {
  const snap = await db().collection(USERS_COLLECTION).orderBy('username').get();
  return snap.docs.map((d) => {
    const data = d.data() as FirestoreUserDoc;
    const { passwordHash: _ph, ...rest } = data;
    void _ph;
    return { ...rest, id: d.id } as PublicUserRow;
  });
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

export async function setUserPasswordAfterEmployeeChange(
  userId: string,
  passwordHash: string
): Promise<void> {
  await db()
    .collection(USERS_COLLECTION)
    .doc(userId)
    .update({
      passwordHash,
      mustChangePassword: false,
      updatedAt: Timestamp.now(),
    });
}
