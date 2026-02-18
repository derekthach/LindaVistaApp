import { NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { requireAuth } from '@/server/auth/session';
import { getRoomUsageFrequency } from '@/lib/server/checkinsRepo';
import { logError, logInfo } from '@/lib/server/log';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';
import { requireEnvs } from '@/lib/server/requireEnv';

const ZONE = 'America/Puerto_Rico';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  logInfo('api.room-usage.start', { requestId });

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

    const data = await getRoomUsageFrequency({ year, month });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof HttpError) {
      logError('api.room-usage.error', { requestId, message: String(err) });
      const { status, body } = toErrorResponse(err, requestId);
      return NextResponse.json(body, { status });
    }
    logError('api.room-usage.error', { requestId, message: String(err) });
    return NextResponse.json({ room_numbers: [], usage_counts: [] });
  }
}
