import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuthorization } from '@/lib/server/cronAuth';
import { runCompletedShiftSummaryCron } from '@/lib/server/shiftSummaryCron';
import { isShiftId } from '@/lib/shifts';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';
import { logError } from '@/lib/server/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Allow enough time for Firestore range queries + upserts. */
export const maxDuration = 60;

/**
 * Vercel Cron adapter — thin auth + orchestration.
 * Paths: /api/cron/shift-summary/overnight|day|evening
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ shift: string }> }
) {
  const requestId = crypto.randomUUID();
  try {
    requireCronAuthorization(request);

    const { shift: shiftParam } = await context.params;
    if (!isShiftId(shiftParam)) {
      throw new HttpError(400, 'INVALID_SHIFT');
    }

    const result = await runCompletedShiftSummaryCron(shiftParam);
    return NextResponse.json(result);
  } catch (err) {
    logError('api.cron.shift-summary.error', {
      requestId,
      message: err instanceof Error ? err.message : String(err),
    });
    const httpErr =
      err instanceof HttpError ? err : new HttpError(500, 'CRON_SHIFT_SUMMARY_FAILED');
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
