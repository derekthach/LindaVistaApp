import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuthorization } from '@/lib/server/cronAuth';
import { sendPhotonConnectivityTestToDerek } from '@/lib/server/photon/photonTest';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';
import { logError } from '@/lib/server/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Secure manual Photon connectivity test.
 * Sends one fixed test iMessage to DAILY_SUMMARY_DEREK_PHONE only.
 * Does not generate summaries or mutate Daily Summary delivery state.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    requireCronAuthorization(request);
    const result = await sendPhotonConnectivityTestToDerek();
    return NextResponse.json({
      success: result.status === 'sent',
      recipientKey: result.recipientKey,
      status: result.status,
      durationMs: result.durationMs,
      requestId,
    });
  } catch (err) {
    logError('api.cron.photon-test.error', {
      requestId,
      message: err instanceof Error ? err.message : String(err),
    });
    const httpErr = err instanceof HttpError ? err : new HttpError(500, 'PHOTON_TEST_FAILED');
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
