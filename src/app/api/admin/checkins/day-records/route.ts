import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth/session';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { listCheckinsByDateRange } from '@/lib/server/checkinsRepo';
import {
  applyAdvancedFilters,
  parseAdvancedFiltersFromSearchParams,
} from '@/lib/checkins/advancedFilters';
import { logError, logInfo } from '@/lib/server/log';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';
import { DateTime } from 'luxon';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ZONE = 'America/Puerto_Rico';

/**
 * Admin-only: lazy-load raw check-ins for a single Puerto Rico business date.
 * Used by multi-day View Check-ins "View Records" — not the initial range overview.
 * Honors the same Advanced Filters query params as the View Check-ins page.
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    await requireAuth('admin');
    await requireAdmin(request);

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date')?.trim() ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new HttpError(400, 'INVALID_BUSINESS_DATE', {
        message: 'Query param date=YYYY-MM-DD is required',
      });
    }

    const todayISO = DateTime.now().setZone(ZONE).toISODate() ?? '';
    if (todayISO && date > todayISO) {
      throw new HttpError(400, 'FUTURE_DATE', { message: 'Dates cannot be later than today.' });
    }

    const filters = parseAdvancedFiltersFromSearchParams({
      receipt: searchParams.get('receipt') ?? undefined,
      shift: searchParams.get('shift') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      room: searchParams.get('room') ?? undefined,
      staff: searchParams.get('staff') ?? undefined,
      payment: searchParams.get('payment') ?? undefined,
    });

    const raw = await listCheckinsByDateRange(date, date);
    const checkins = applyAdvancedFilters(raw, filters);
    logInfo('api.admin.checkins.day-records.complete', {
      requestId,
      date,
      docsReturned: checkins.length,
      advancedFilters: true,
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
