import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuthorization } from '@/lib/server/cronAuth';
import { deliverPersistedDailySummaryToDerek } from '@/lib/server/photon/deliverPersistedDailySummary';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';
import { logError } from '@/lib/server/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Secure manual delivery of an already-persisted Daily Summary to Derek only.
 * Reads dailySummaries/{businessDate} + 3 shiftSummaries docs — no raw check-ins.
 * Honors Derek delivery idempotency (skips if already sent).
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 * Query: ?businessDate=YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    requireCronAuthorization(request);
    const businessDate = request.nextUrl.searchParams.get('businessDate')?.trim() ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
      throw new HttpError(400, 'INVALID_BUSINESS_DATE', {
        message: 'Query param businessDate=YYYY-MM-DD is required',
      });
    }

    const result = await deliverPersistedDailySummaryToDerek(businessDate);
    return NextResponse.json({
      success: result.delivery.status === 'sent' || result.delivery.status === 'skipped',
      businessDate: result.businessDate,
      messagePreviewLength: result.messagePreviewLength,
      delivery: {
        recipientKey: result.delivery.recipientKey,
        status: result.delivery.status,
        skipReason: result.delivery.skipReason,
        durationMs: result.delivery.durationMs,
        ...(result.delivery.error ? { error: result.delivery.error } : {}),
      },
      requestId,
    });
  } catch (err) {
    logError('api.cron.daily-summary-delivery-test.error', {
      requestId,
      message: err instanceof Error ? err.message : String(err),
    });
    const httpErr =
      err instanceof HttpError ? err : new HttpError(500, 'DAILY_SUMMARY_DELIVERY_TEST_FAILED');
    const { status, body } = toErrorResponse(httpErr, requestId);
    return NextResponse.json(
      {
        success: false,
        recipientKey: 'derek',
        ...body,
      },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
