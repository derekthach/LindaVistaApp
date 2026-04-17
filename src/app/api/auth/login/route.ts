import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { loginSessionOptions } from '@/server/auth/session';
import type { SessionData } from '@/types';
import { authenticateUser } from '@/server/auth/users';
import { isGuestEmployeeUsername } from '@/lib/auth/guestEmployee';
import { sessionHardMsForRole } from '@/server/auth/sessionPolicy';

export const runtime = 'nodejs';

/** Use the same origin the browser sees (Vercel sets these). */
function getOrigin(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host;
  const proto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol || 'https';
  return `${proto}://${host}`;
}

function loginRedirect(origin: string, error?: string) {
  const path = error ? `/login?error=${encodeURIComponent(error)}` : '/login';
  return NextResponse.redirect(new URL(path, origin), 303);
}

/**
 * Login uses `getIronSession(await cookies(), opts)` then `session.save()` before returning
 * `NextResponse.redirect`, matching iron-session’s App Router pattern. Writing the session
 * onto a redirect response created first (`getIronSession(req, res, opts)`) can fail to attach
 * Set-Cookie reliably in some Next.js / hosting combinations — a common cause of “login twice”.
 */
export async function POST(request: NextRequest) {
  const origin = getOrigin(request);
  try {
    if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
      return NextResponse.redirect(new URL('/login?error=config', origin), 303);
    }

    const formData = await request.formData();
    const username = (formData.get('username') as string)?.trim();
    const password = formData.get('password') as string;

    if (!username || !password) {
      return loginRedirect(origin, 'missing');
    }

    const user = await authenticateUser(username, password);
    if (!user) {
      return loginRedirect(origin, 'invalid');
    }

    const redirectPath = user.mustChangePassword
      ? '/employee/change-password'
      : user.role === 'admin'
        ? '/dashboard'
        : '/checkins/new';

    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, loginSessionOptions(user.role));
    session.username = user.username;
    session.role = user.role;
    session.isLoggedIn = true;
    if (user.userId) {
      session.userId = user.userId;
    } else if (isGuestEmployeeUsername(user.username)) {
      session.userId = 'guest';
    }
    session.displayName = user.displayName;
    session.mustChangePassword = user.mustChangePassword;
    const now = Date.now();
    session.hardExpiresAt = now + sessionHardMsForRole(user.role);
    session.lastActivityAt = now;
    await session.save();

    const res = NextResponse.redirect(new URL(redirectPath, origin), 303);
    res.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return res;
  } catch (err) {
    console.error('[auth/login] POST error', err);
    return loginRedirect(origin, 'server');
  }
}
