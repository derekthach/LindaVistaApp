import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/server/auth/session';
import type { SessionData } from '@/types';

export const runtime = 'nodejs';

/** Clears the session cookie (only callable from Route Handler / redirect). */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  session.destroy();
  await session.save();
  const url = new URL('/login', request.url);
  return NextResponse.redirect(url);
}
