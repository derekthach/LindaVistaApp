import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth/session';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { getFilterStaffDisplayNames } from '@/lib/server/checkoutStaffAllowlist';
import { FULL_ROOM_CATALOG } from '@/lib/checkins/rooms';
import { PAYMENT_METHODS } from '@/lib/checkins/paymentMethods';
import { logError } from '@/lib/server/log';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Dropdown options for View Check-ins Advanced Filters.
 * Rooms = full catalog; staff includes inactive/historical display names.
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    await requireAuth('admin');
    await requireAdmin(request);
    const staff = await getFilterStaffDisplayNames();
    return NextResponse.json({
      rooms: FULL_ROOM_CATALOG.map((r) => String(r)),
      staff,
      paymentMethods: [...PAYMENT_METHODS],
      types: ['room', 'food', 'beer'] as const,
      shifts: ['0', '1', '2'] as const,
    });
  } catch (err) {
    logError('api.admin.checkins.filter-options.error', {
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
            : new HttpError(500, 'FILTER_OPTIONS_FAILED');
    const { status, body } = toErrorResponse(httpErr, requestId);
    return NextResponse.json(body, { status });
  }
}
