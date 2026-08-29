import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth/session';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { listCheckinsByDateRange } from '@/lib/server/checkinsRepo';
import { logError, logInfo } from '@/lib/server/log';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';
import { DateTime } from 'luxon';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ZONE = 'America/Puerto_Rico';

/**
 * Admin-only: lazy-load raw check-ins for a single Puerto Rico business date.
 * Used by multi-day View Check-ins "View Records" — not the initial range overview.
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    await requireAuth('admin');
    await requireAdmin(request);

    const date = request.nextUrl.searchParams.get('date')?.trim() ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new HttpError(400, 'INVALID_BUSINESS_DATE', {
        message: 'Query param date=YYYY-MM-DD is required',
      });
    }

    const todayISO = DateTime.now().setZone(ZONE).toISODate() ?? '';
    if (todayISO && date > todayISO) {
      throw new HttpError(400, 'FUTURE_DATE', { message: 'Dates cannot be later than today.' });
    }

    const checkins = await listCheckinsByDateRange(date, date);
    logInfo('api.admin.checkins.day-records.complete', {
      requestId,
      date,
      docsReturned: checkins.length,
    });
    return NextResponse.json({ date, checkins });
  } catch (err) {
    logError('api.admin.checkins.day-records.error', {
      requestId,
      message: err instanceof Error ? err.message : String(err),
    });
    const httpErr =
      err instanceof HttpError
        ? err
        : err instanceof Error && err.message === 'Not authenticated'
          ? new HttpError(401, 'UNAUTHORIZED')
          : err instanceof Error && err.message === 'Insufficient permissions'
            ? new HttpError(403, 'FORBIDDEN')
            : new HttpError(500, 'DAY_RECORDS_FAILED');
    const { status, body } = toErrorResponse(httpErr, requestId);
    return NextResponse.json(body, { status });
  }
}
