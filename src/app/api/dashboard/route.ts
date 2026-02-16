import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth/session';
import { get7DayTrends } from '@/lib/server/checkinsRepo';
import { logError, logInfo } from '@/lib/server/log';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';
import { requireEnvs } from '@/lib/server/requireEnv';
import { DateTime } from 'luxon';

export const runtime = 'nodejs';

function empty7DayData() {
  const endDate = DateTime.now().setZone('America/Puerto_Rico');
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    dates.push(endDate.minus({ days: i }).toFormat('MM/dd'));
  }
  return { dates, checkins: dates.map(() => 0), revenue: dates.map(() => 0) };
}

export async function GET() {
  const requestId = crypto.randomUUID();
  logInfo('api.dashboard.start', { requestId });

  try {
    if (process.env.NODE_ENV === 'production') {
      requireEnvs(['SESSION_SECRET']);
    }
    await requireAuth('admin');
    const data = await get7DayTrends();
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof HttpError) {
      logError('api.dashboard.error', { requestId, message: String(err) });
      const { status, body } = toErrorResponse(err, requestId);
      return NextResponse.json(body, { status });
    }
    logError('api.dashboard.error', { requestId, message: String(err) });
    return NextResponse.json(empty7DayData());
  }
}
