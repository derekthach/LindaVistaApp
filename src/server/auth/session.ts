import { redirect } from 'next/navigation';
import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import type { SessionData } from '@/types';

export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET ||
    'dev_only_change_me_to_32_characters_minimum_length',
  cookieName: 'linda_vista_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function requireAuth(requiredRole?: 'admin' | 'employee') {
  const session = await getSession();

  if (!session.isLoggedIn || !session.username) {
    redirect('/login');
  }

  if (requiredRole && session.role !== requiredRole && session.role !== 'admin') {
    redirect('/checkins/new');
  }

  return session;
}
