import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/server/auth/session';
import type { SessionData } from '@/types';
import { authenticateUser } from '@/server/auth/users';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const username = (formData.get('username') as string)?.trim();
    const password = formData.get('password') as string;

    if (!username || !password) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const user = await authenticateUser(username, password);
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const redirectUrl = user.role === 'admin' ? '/dashboard' : '/checkins/new';
    // 303 See Other so browser does GET and accepts Set-Cookie (avoids redirect loops)
    const res = NextResponse.redirect(new URL(redirectUrl, request.url), 303);
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
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
    }
    return res;
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
