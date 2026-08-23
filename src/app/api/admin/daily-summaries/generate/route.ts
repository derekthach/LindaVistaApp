import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth/session';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { generateAndSaveDailySummaryForBusinessDate } from '@/lib/server/dailySummariesRepo';
import { toDailySummaryDoc } from '@/lib/shifts';
import { logError, logInfo } from '@/lib/server/log';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';

export const runtime = 'nodejs';

/**
 * Admin-only: read 3 persisted Shift Summaries → calculateDailySummary → upsert dailySummaries/{date}.
 * Does not reread raw check-ins. Does not run on normal View Check-Ins render.
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  logInfo('api.admin.daily-summaries.generate.start', { requestId });

  try {
    await requireAuth('admin');
    await requireAdmin(request);

    const body = (await request.json().catch(() => ({}))) as { businessDate?: string };
    const businessDate = typeof body.businessDate === 'string' ? body.businessDate.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
      throw new HttpError(400, 'INVALID_BUSINESS_DATE');
    }

    const summary = await generateAndSaveDailySummaryForBusinessDate(businessDate);
    logInfo('api.admin.daily-summaries.generate.success', {
      requestId,
      businessDate,
      totalRevenue: summary.totalRevenue,
    });
    return NextResponse.json({
      ok: true,
      businessDate,
      summary: toDailySummaryDoc(summary),
    });
  } catch (err) {
    logError('api.admin.daily-summaries.generate.error', {
      requestId,
      message: String(err),
    });
    const httpErr =
      err instanceof HttpError
        ? err
        : err instanceof Error && err.message === 'Not authenticated'
          ? new HttpError(401, 'UNAUTHORIZED')
          : err instanceof Error && err.message === 'Insufficient permissions'
            ? new HttpError(403, 'FORBIDDEN')
            : new HttpError(500, 'GENERATE_FAILED');
    const { status, body } = toErrorResponse(httpErr, requestId);
    return NextResponse.json(body, { status });
  }
}
