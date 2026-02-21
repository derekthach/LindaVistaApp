import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth/session';

export const runtime = 'nodejs';

/**
 * Sets the lv_admin cookie when the session is admin. Called by the client after
 * login so we only set one cookie per response (login sets session; this sets admin).
 */
export async function GET() {
  const session = await requireAuth('admin');
  const secret = process.env.LV_ADMIN_SECRET;
  if (!secret) {
    return new NextResponse(null, { status: 204 });
  }
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set('lv_admin', secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
