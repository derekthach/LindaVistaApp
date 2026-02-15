'use server';

import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { authenticateUser } from '@/server/auth/users';

export async function loginAction(formData: FormData) {
  const username = (formData.get('username') as string)?.trim();
  const password = formData.get('password') as string;

  if (!username || !password) {
    redirect('/login');
  }

  const user = await authenticateUser(username, password);
  if (!user) {
    redirect('/login');
  }

  const session = await getSession();
  session.username = user.username;
  session.role = user.role;
  session.isLoggedIn = true;
  await session.save();

  redirect(user.role === 'admin' ? '/dashboard' : '/checkin');
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  redirect('/login');
}
