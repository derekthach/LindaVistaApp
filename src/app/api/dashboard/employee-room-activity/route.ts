import { NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { requireAuth } from '@/server/auth/session';
import { getEmployeeRoomActivityForMonth } from '@/lib/server/checkinsRepo';
import { logError, logInfo } from '@/lib/server/log';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';
import { requireEnvs } from '@/lib/server/requireEnv';
import type { EmployeeRoomActivityData } from '@/types';

const ZONE = 'America/Puerto_Rico';

const EMPTY: EmployeeRoomActivityData = {
  check_ins: { labels: [], counts: [] },
  cleanups: { labels: [], counts: [] },
};

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  logInfo('api.dashboard.employee-room-activity.start', { requestId });

  try {
    if (process.env.NODE_ENV === 'production') {
      requireEnvs(['SESSION_SECRET']);
    }
    await requireAuth('admin');

    const now = DateTime.now().setZone(ZONE);
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');
    const month = monthParam ? parseInt(monthParam, 10) : now.month;
    const year = yearParam ? parseInt(yearParam, 10) : now.year;

    const data = await getEmployeeRoomActivityForMonth({ year, month });
    logInfo('api.dashboard.employee-room-activity.success', {
      requestId,
      checkInBars: data.check_ins.labels.length,
      cleanupBars: data.cleanups.labels.length,
    });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof HttpError) {
      logError('api.dashboard.employee-room-activity.error', { requestId, message: String(err) });
      const { status, body } = toErrorResponse(err, requestId);
      return NextResponse.json(body, { status });
    }
    logError('api.dashboard.employee-room-activity.error', { requestId, message: String(err) });
    return NextResponse.json(EMPTY);
  }
}
