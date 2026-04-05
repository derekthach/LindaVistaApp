import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { loginSessionOptions } from '@/server/auth/session';
import type { SessionData } from '@/types';
import { authenticateUser } from '@/server/auth/users';
import { sessionHardMsForRole } from '@/server/auth/sessionPolicy';

export const runtime = 'nodejs';

/** Use the same origin the browser sees (Vercel sets these). */
function getOrigin(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host;
  const proto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol || 'https';
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest) {
  const origin = getOrigin(request);
  try {
    // In production (including Preview), SESSION_SECRET is required or the session cookie
    // won’t be valid. Without it, redirect so the user sees the config error on the login page.
    if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
      return NextResponse.redirect(new URL('/login?error=config', origin), 303);
    }

    const formData = await request.formData();
    const username = (formData.get('username') as string)?.trim();
    const password = formData.get('password') as string;

    if (!username || !password) {
      return NextResponse.redirect(new URL('/login', origin));
    }

    const user = await authenticateUser(username, password);
    if (!user) {
      return NextResponse.redirect(new URL('/login', origin));
    }

    const redirectPath = user.mustChangePassword
      ? '/employee/change-password'
      : user.role === 'admin'
        ? '/dashboard'
        : '/checkins/new';
    const res = NextResponse.redirect(new URL(redirectPath, origin), 303);
    res.headers.set('Cache-Control', 'private, no-store, max-age=0');
    const opts = loginSessionOptions(user.role);
    const session = await getIronSession<SessionData>(request, res, opts);
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
    return res;
  } catch (err) {
    console.error('[auth/login] POST error', err);
    return NextResponse.redirect(new URL('/login', origin));
  }
}
