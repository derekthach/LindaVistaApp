import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/server/auth/session';
import type { SessionData } from '@/types';
import { isGuestEmployeeUsername } from '@/lib/auth/guestEmployee';
import { sessionHardMsForRole } from '@/server/auth/sessionPolicy';

export const runtime = 'nodejs';

/** Backfills hardExpiresAt / lastActivityAt for older cookies (cookie write only in Route Handler). */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  if (!session.isLoggedIn || !session.username) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const now = Date.now();
  let changed = false;
  if (session.hardExpiresAt == null) {
    session.hardExpiresAt = now + sessionHardMsForRole(session.role);
    changed = true;
  }
  if (session.lastActivityAt == null) {
    session.lastActivityAt = now;
    changed = true;
  }
  if (isGuestEmployeeUsername(session.username) && !session.userId?.trim()) {
    session.userId = 'guest';
    changed = true;
  }
  if (changed) {
    await session.save();
  }

  const next =
    session.mustChangePassword === true
      ? '/employee/change-password'
      : session.role === 'admin'
        ? '/dashboard'
        : '/checkins/new';
  return NextResponse.redirect(new URL(next, request.url));
}
