import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import type { SessionData } from '@/types';

const EMPTY_SESSION: SessionData = {
  username: '',
  role: 'employee',
  isLoggedIn: false,
};

export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET ||
    'dev_only_change_me_to_32_characters_minimum_length',
  cookieName: 'linda_vista_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  },
};

export async function getSession(): Promise<SessionData> {
  const cookieStore = await cookies();
  try {
    return await getIronSession<SessionData>(cookieStore, sessionOptions);
  } catch {
    return EMPTY_SESSION;
  }
}

export async function requireAuth(requiredRole?: 'admin' | 'employee') {
  const session = await getSession();

  if (!session.isLoggedIn || !session.username) {
    throw new Error('Not authenticated');
  }

  if (requiredRole && session.role !== requiredRole && session.role !== 'admin') {
    throw new Error('Insufficient permissions');
  }

  return session;
}
