import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuthorization } from '@/lib/server/cronAuth';
import { runDailySummaryCron } from '@/lib/server/dailySummaryCron';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';
import { logError } from '@/lib/server/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Allow enough time for day-bounded Firestore queries + 4 upserts. */
export const maxDuration = 60;

/**
 * Once-daily Hobby-compatible Cron (9:00 AM Puerto Rico / 13:00 UTC).
 * Generates previous PR calendar day's Shift Summaries + Daily Summary.
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    requireCronAuthorization(request);
    const result = await runDailySummaryCron();
    return NextResponse.json(result);
  } catch (err) {
    logError('api.cron.daily-summary.error', {
      requestId,
      message: err instanceof Error ? err.message : String(err),
    });
    const httpErr =
      err instanceof HttpError ? err : new HttpError(500, 'CRON_DAILY_SUMMARY_FAILED');
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
