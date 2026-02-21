import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/server/auth/session';
import type { SessionData } from '@/types';
import { authenticateUser } from '@/server/auth/users';

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

    // Single redirect + single Set-Cookie so the session sticks in production/preview
    // (some runtimes drop a second cookie; an extra GET can also lose cookies).
    // Admin goes straight to /dashboard; DashboardEnsureAdminCookie sets lv_admin in a follow-up request.
    const redirectPath = user.role === 'admin' ? '/dashboard' : '/checkins/new';
    const res = NextResponse.redirect(new URL(redirectPath, origin), 303);
    res.headers.set('Cache-Control', 'private, no-store, max-age=0');
    const session = await getIronSession<SessionData>(request, res, sessionOptions);
    session.username = user.username;
    session.role = user.role;
    session.isLoggedIn = true;
    await session.save();
    return res;
  } catch (err) {
    console.error('[auth/login] POST error', err);
    return NextResponse.redirect(new URL('/login', origin));
  }
}
