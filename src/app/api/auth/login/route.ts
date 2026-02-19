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

    // Redirect everyone to /checkins/new first so the first GET hits a path that works
    // (e.g. under Vercel Deployment Protection); then client can send admin to /dashboard.
    const res = NextResponse.redirect(new URL('/checkins/new', origin), 303);
    res.headers.set('Cache-Control', 'private, no-store, max-age=0');
    const session = await getIronSession<SessionData>(request, res, sessionOptions);
    session.username = user.username;
    session.role = user.role;
    session.isLoggedIn = true;
    await session.save();
    if (user.role === 'admin' && process.env.LV_ADMIN_SECRET) {
      res.cookies.set('lv_admin', process.env.LV_ADMIN_SECRET, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
    }
    return res;
  } catch (err) {
    console.error('[auth/login] POST error', err);
    return NextResponse.redirect(new URL('/login', origin));
  }
}
