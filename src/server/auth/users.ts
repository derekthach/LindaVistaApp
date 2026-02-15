import fs from 'fs';
import path from 'path';
import { verifyPassword } from '@/lib/server/password';
import type { User } from '@/types';

const usersFilePath = path.join(process.cwd(), 'login-system', 'users.json');

export function getUsers(): User[] {
  const fileContent = fs.readFileSync(usersFilePath, 'utf-8');
  return JSON.parse(fileContent) as User[];
}

export function findUser(username: string): User | undefined {
  return getUsers().find((user) => user.username === username);
}

export async function authenticateUser(username: string, password: string) {
  const user = findUser(username);
  if (!user) return null;

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) return null;

  return user;
}
