import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth/session';
import { countPendingPasswordResets } from '@/lib/server/usersRepo';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';
import { requireEnvs } from '@/lib/server/requireEnv';

export const runtime = 'nodejs';

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    if (process.env.NODE_ENV === 'production') {
      requireEnvs(['SESSION_SECRET']);
    }
    await requireAuth('admin');
    const count = await countPendingPasswordResets();
    return NextResponse.json({ count });
  } catch (err) {
    if (err instanceof HttpError) {
      const { status, body } = toErrorResponse(err, requestId);
      return NextResponse.json(body, { status });
    }
    return NextResponse.json({ count: 0 });
  }
}
