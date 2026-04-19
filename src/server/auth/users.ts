import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import type { User, UserRole } from '@/types';
import { isGuestEmployeeUsername } from '@/lib/auth/guestEmployee';
import {
  getUserDocByUsername,
  updateUserLastLogin,
  userDisplaySnapshot,
  type FirestoreUserDoc,
} from '@/lib/server/usersRepo';

const usersFilePath = path.join(process.cwd(), 'login-system', 'users.json');

export function getUsers(): User[] {
  const fileContent = fs.readFileSync(usersFilePath, 'utf-8');
  return JSON.parse(fileContent) as User[];
}

export function findUser(username: string): User | undefined {
  return getUsers().find((user) => user.username === username);
}

/** Persists a new hash and clears the first-login flag for legacy `login-system/users.json` accounts. */
export function updateJsonUserPassword(username: string, passwordHash: string): void {
  const users = getUsers();
  const idx = users.findIndex((u) => u.username === username);
  if (idx === -1) {
    throw new Error(`[auth] JSON user not found: ${username}`);
  }
  const row = users[idx];
  row.password = passwordHash;
  row.mustChangePassword = false;
  fs.writeFileSync(usersFilePath, `${JSON.stringify(users, null, 2)}\n`, 'utf-8');
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export type AuthenticatedUser = {
  username: string;
  role: UserRole;
  userId?: string;
  /** Omitted for the shared `guest` employee login so staff-facing forms do not auto-fill a label. */
  displayName?: string;
  mustChangePassword: boolean;
  source: 'firestore' | 'json';
};

async function authenticateFirestoreUser(
  username: string,
  password: string
): Promise<AuthenticatedUser | null> {
  const doc = await getUserDocByUsername(username);
  if (!doc) return null;
  if (doc.status !== 'active') return null;
  const ok = await verifyPassword(password, doc.passwordHash);
  if (!ok) return null;
  return {
    username: doc.username,
    role: doc.role,
    userId: doc.id,
    displayName: isGuestEmployeeUsername(doc.username) ? undefined : userDisplaySnapshot(doc),
    mustChangePassword: doc.mustChangePassword === true,
    source: 'firestore',
  };
}

function authenticateJsonUser(username: string, password: string): Promise<AuthenticatedUser | null> {
  const user = findUser(username);
  if (!user) return Promise.resolve(null);
  return verifyPassword(password, user.password).then((ok) => {
    if (!ok) return null;
    return {
      username: user.username,
      role: user.role,
      displayName:
        user.username === 'admin'
          ? 'Administrator'
          : user.username === 'guest'
            ? undefined
            : user.name ?? user.username,
      mustChangePassword: user.mustChangePassword === true,
      source: 'json' as const,
    };
  });
}

/**
 * Password check is server-side only. Tries Firestore `users` (by username), then legacy `users.json`.
 */
export async function authenticateUser(username: string, password: string): Promise<AuthenticatedUser | null> {
  const trimmed = username.trim();
  if (!trimmed) return null;

  const fromFs = await authenticateFirestoreUser(trimmed, password);
  if (fromFs) {
    await updateUserLastLogin(fromFs.userId!).catch((e) =>
      console.error('[auth] updateUserLastLogin', e)
    );
    return fromFs;
  }

  return authenticateJsonUser(trimmed, password);
}

export type { FirestoreUserDoc };
