import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/server/auth/session';
import type { SessionData } from '@/types';
import { inactivityMsForRole, sessionHardMsForRole } from '@/server/auth/sessionPolicy';

export const runtime = 'nodejs';

/**
 * Updates lastActivityAt (cookie write in Route Handler).
 * Called from the client on navigation so inactivity works beyond API-only usage.
 */
export async function POST() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  if (!session.isLoggedIn || !session.username) {
    return new NextResponse(null, { status: 401 });
  }

  const now = Date.now();
  const role = session.role;

  if (session.hardExpiresAt == null) {
    session.hardExpiresAt = now + sessionHardMsForRole(role);
  }
  if (session.lastActivityAt == null) {
    session.lastActivityAt = now;
  }

  if (now > session.hardExpiresAt) {
    session.destroy();
    await session.save();
    return new NextResponse(null, { status: 401 });
  }

  if (now - session.lastActivityAt > inactivityMsForRole(role)) {
    session.destroy();
    await session.save();
    return new NextResponse(null, { status: 401 });
  }

  session.lastActivityAt = now;
  await session.save();
  return new NextResponse(null, { status: 204 });
}
