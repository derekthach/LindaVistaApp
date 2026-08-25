import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuthorization } from '@/lib/server/cronAuth';
import { deliverPersistedDailySummaryToActiveRecipients } from '@/lib/server/photon/deliverPersistedDailySummary';
import { hasFailedManagementDelivery } from '@/lib/server/photon/sendDailyManagementMessage';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';
import { logError } from '@/lib/server/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Secure manual delivery of an already-persisted Daily Summary to all active recipients
 * (Derek + Dad). Formats once; independent per-recipient idempotency.
 * Reads dailySummaries/{businessDate} + 3 shiftSummaries docs — no raw check-ins.
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

    const result = await deliverPersistedDailySummaryToActiveRecipients(businessDate);
    const deliveries = result.deliveries.map((d) => ({
      recipientKey: d.recipientKey,
      status: d.status,
      skipReason: d.skipReason,
      durationMs: d.durationMs,
      ...(d.error ? { error: d.error } : {}),
    }));
    const anyFailed = hasFailedManagementDelivery(result.deliveries);
    const allOk = result.deliveries.every((d) => d.status === 'sent' || d.status === 'skipped');

    return NextResponse.json({
      success: allOk && !anyFailed,
      businessDate: result.businessDate,
      messagePreviewLength: result.messagePreviewLength,
      deliveries,
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
        ...body,
      },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
