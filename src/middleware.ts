import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/server/auth/session';
import type { SessionData } from '@/types';

const EMPTY_SESSION: SessionData = {
  username: '',
  role: 'employee',
  isLoggedIn: false,
};

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  // Let OPTIONS through without session (avoids 400 from toolbar/preflight)
  if (request.method === 'OPTIONS') {
    return response;
  }

  let session: SessionData;
  try {
    session = await getIronSession<SessionData>(request, response, sessionOptions);
  } catch {
    session = EMPTY_SESSION;
  }
  const { pathname } = request.nextUrl;

  if (pathname === '/login') {
    if (session.isLoggedIn) {
      return NextResponse.redirect(
        new URL(session.role === 'admin' ? '/dashboard' : '/checkin', request.url)
      );
    }
    return response;
  }

  if (pathname === '/') {
    if (!session.isLoggedIn) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.redirect(
      new URL(session.role === 'admin' ? '/dashboard' : '/checkin', request.url)
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
        return NextResponse.redirect(new URL('/checkin', request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*', '/checkin/:path*', '/checkins/:path*', '/export/:path*'],
};
