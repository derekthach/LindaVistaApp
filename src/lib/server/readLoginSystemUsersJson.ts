import fs from 'fs';
import path from 'path';
import type { User } from '@/types';

const usersFilePath = path.join(process.cwd(), 'login-system', 'users.json');

/** Reads `login-system/users.json` without importing `@/server/auth/users` (avoids circular deps with `usersRepo`). */
export function readLoginSystemUsersJson(): User[] {
  try {
    const raw = fs.readFileSync(usersFilePath, 'utf8');
    return JSON.parse(raw) as User[];
  } catch {
    return [];
  }
}
