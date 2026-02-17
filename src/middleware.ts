import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/server/auth/session';
import type { SessionData } from '@/types';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  const { pathname } = request.nextUrl;

  if (pathname === '/login') {
    if (session.isLoggedIn) {
      return NextResponse.redirect(
        new URL(session.role === 'admin' ? '/dashboard' : '/checkins/new', request.url)
      );
    }
    return response;
  }

  if (pathname === '/') {
    if (!session.isLoggedIn) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.redirect(
      new URL(session.role === 'admin' ? '/dashboard' : '/checkins/new', request.url)
    );
  }

  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/checkins') ||
    pathname.startsWith('/export') ||
    pathname.startsWith('/checkin')
  ) {
    if (!session.isLoggedIn) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/checkins') ||
      pathname.startsWith('/export')
    ) {
      if (session.role !== 'admin') {
        return NextResponse.redirect(new URL('/checkins/new', request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*', '/checkin/:path*', '/checkins/:path*', '/export/:path*'],
};
