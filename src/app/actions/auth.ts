'use server';

import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { getSession, loginSessionOptions } from '@/server/auth/session';
import { authenticateUser } from '@/server/auth/users';
import { sessionHardMsForRole } from '@/server/auth/sessionPolicy';
import type { SessionData } from '@/types';

export async function loginAction(formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    redirect('/login');
  }

  const user = await authenticateUser(username, password);
  if (!user) {
    redirect('/login');
  }

  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, loginSessionOptions(user.role));
  session.username = user.username;
  session.role = user.role;
  session.isLoggedIn = true;
  if (user.userId) session.userId = user.userId;
  session.displayName = user.displayName;
  session.mustChangePassword = user.mustChangePassword;
  const now = Date.now();
  session.hardExpiresAt = now + sessionHardMsForRole(user.role);
  session.lastActivityAt = now;
  await session.save();

  if (user.mustChangePassword) {
    redirect('/employee/change-password');
  }
  redirect(user.role === 'admin' ? '/dashboard' : '/checkins/new');
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  redirect('/login');
}
