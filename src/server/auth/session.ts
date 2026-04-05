import { redirect } from 'next/navigation';
import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import type { SessionData, UserRole } from '@/types';
import { HttpError } from '@/lib/server/httpError';
import {
  cookieMaxAgeSecForRole,
  inactivityMsForRole,
  sessionHardMsForRole,
} from '@/server/auth/sessionPolicy';

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

export function loginSessionOptions(role: UserRole): SessionOptions {
  return {
    ...sessionOptions,
    cookieOptions: {
      ...sessionOptions.cookieOptions,
      maxAge: cookieMaxAgeSecForRole(role),
    },
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

function migrateSessionClockIfNeeded(session: SessionData): boolean {
  let changed = false;
  const role = session.role;
  if (session.hardExpiresAt == null) {
    session.hardExpiresAt = Date.now() + sessionHardMsForRole(role);
    changed = true;
  }
  if (session.lastActivityAt == null) {
    session.lastActivityAt = Date.now();
    changed = true;
  }
  return changed;
}

/**
 * Server Components must not call session.save() / destroy()+save (Next.js: cookies only in Action or Route Handler).
 * Redirect to Route Handlers for migration, clearing, or rely on /api/auth/touch-session for activity bumps.
 */
export function assertSessionValidForPageOrRedirect(session: SessionData): void {
  if (!session.isLoggedIn || !session.username) return;

  if (session.hardExpiresAt == null || session.lastActivityAt == null) {
    redirect('/api/auth/migrate-session');
  }

  const now = Date.now();
  const role = session.role;

  if (now > session.hardExpiresAt) {
    redirect('/api/auth/clear-session');
  }

  if (now - session.lastActivityAt > inactivityMsForRole(role)) {
    redirect('/api/auth/clear-session');
  }
}

export type AuthPageContext = 'default' | 'change-password';

export async function requireAuth(
  requiredRole?: 'admin' | 'employee',
  context: AuthPageContext = 'default'
) {
  const session = await getSession();

  if (!session.isLoggedIn || !session.username) {
    redirect('/login');
  }

  assertSessionValidForPageOrRedirect(session);

  if (session.mustChangePassword) {
    if (context !== 'change-password') {
      redirect('/employee/change-password');
    }
  } else if (context === 'change-password') {
    redirect(session.role === 'admin' ? '/dashboard' : '/checkins/new');
  }

  if (requiredRole && session.role !== requiredRole && session.role !== 'admin') {
    redirect('/checkins/new');
  }

  return session;
}

/** Login page: cannot mutate cookies here — redirect to handlers if the cookie should be cleared or migrated. */
export async function flushStaleSessionOnLoginPage(): Promise<void> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.username) return;

  if (session.hardExpiresAt == null || session.lastActivityAt == null) {
    redirect('/api/auth/migrate-session');
  }

  const now = Date.now();
  const role = session.role;

  if (now > session.hardExpiresAt) {
    redirect('/api/auth/clear-session');
  }

  if (now - session.lastActivityAt > inactivityMsForRole(role)) {
    redirect('/api/auth/clear-session');
  }
}

/** API routes: validates session, touches activity — cookie writes allowed in Route Handlers. */
export async function requireSessionApi(): Promise<SessionData> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.username) {
    throw new HttpError(401, 'UNAUTHORIZED', { message: 'Not authenticated' });
  }

  if (migrateSessionClockIfNeeded(session)) {
    await session.save();
  }

  const now = Date.now();
  const role = session.role;

  if (session.hardExpiresAt != null && now > session.hardExpiresAt) {
    session.destroy();
    await session.save();
    throw new HttpError(401, 'UNAUTHORIZED', { message: 'Session expired' });
  }

  const inactiveMs = inactivityMsForRole(role);
  if (session.lastActivityAt != null && now - session.lastActivityAt > inactiveMs) {
    session.destroy();
    await session.save();
    throw new HttpError(401, 'UNAUTHORIZED', { message: 'Session expired' });
  }

  if (session.mustChangePassword) {
    throw new HttpError(403, 'MUST_CHANGE_PASSWORD', { message: 'Password change required' });
  }

  session.lastActivityAt = now;
  await session.save();
  return session;
}
