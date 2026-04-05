import { NextRequest, NextResponse } from 'next/server';
import { requestPasswordResetByUsername } from '@/lib/server/usersRepo';

export const runtime = 'nodejs';

const GENERIC_MESSAGE =
  'If an account exists for that username, your request was received. An administrator can reset your password.';

export async function POST(request: NextRequest) {
  let username = '';
  try {
    const body = (await request.json()) as { username?: unknown };
    username = typeof body.username === 'string' ? body.username.trim() : '';
  } catch {
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }

  if (username) {
    await requestPasswordResetByUsername(username).catch((e) =>
      console.error('[forgot-password]', e)
    );
  }

  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
}
