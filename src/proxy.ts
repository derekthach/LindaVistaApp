import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js 16 proxy (replaces deprecated middleware).
 * Auth is handled in pages/layouts via getSession() and redirect(), not here,
 * to avoid redirect loops from session read differences at the proxy boundary.
 */
export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/dashboard/:path*',
    '/admin/:path*',
    '/employee/:path*',
    '/checkin/:path*',
    '/checkins/:path*',
    '/export/:path*',
  ],
};
