import { NextResponse } from 'next/server';
import { requireSessionApi } from '@/server/auth/session';
import { listRecentCheckinsForEmployee } from '@/lib/server/checkinsRepo';
import { HttpError } from '@/lib/server/httpError';
import { logError } from '@/lib/server/log';

export const runtime = 'nodejs';

/** Employee-only: own check-ins in the rolling edit window (default 8h). */
export async function GET() {
  try {
    const session = await requireSessionApi();
    if (session.role !== 'employee') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const checkins = await listRecentCheckinsForEmployee({
      userId: session.userId,
      username: session.username ?? '',
    });
    return NextResponse.json({ checkins });
  } catch (err) {
    logError('api.checkins.my-recent', { message: String(err) });
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to load check-ins' }, { status: 500 });
  }
}
