import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuthorization } from '@/lib/server/cronAuth';
import { sendPhotonConnectivityTest } from '@/lib/server/photon/photonTest';
import { parseManagementRecipientKey } from '@/lib/server/photon/recipients';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';
import { logError } from '@/lib/server/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Secure manual Photon connectivity test.
 * Query: ?recipient=derek|dad (default derek). Only allow-listed keys; no arbitrary phones.
 * Sends one fixed test iMessage to that recipient only.
 * Does not generate summaries or mutate Daily Summary delivery state.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  let recipientKey = parseManagementRecipientKey(request.nextUrl.searchParams.get('recipient'));
  if (request.nextUrl.searchParams.get('recipient') == null) {
    recipientKey = 'derek';
  }
  try {
    requireCronAuthorization(request);
    if (!recipientKey) {
      throw new HttpError(400, 'INVALID_PHOTON_TEST_RECIPIENT', {
        message: 'Query param recipient must be derek or dad',
      });
    }

    const result = await sendPhotonConnectivityTest(recipientKey);
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
      recipientKey: recipientKey ?? null,
      message: err instanceof Error ? err.message : String(err),
    });
    const httpErr = err instanceof HttpError ? err : new HttpError(500, 'PHOTON_TEST_FAILED');
    const { status, body } = toErrorResponse(httpErr, requestId);
    return NextResponse.json(
      {
        success: false,
        recipientKey: recipientKey ?? null,
        ...body,
      },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
