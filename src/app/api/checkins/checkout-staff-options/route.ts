import { NextResponse } from 'next/server';
import { requireSessionApi } from '@/server/auth/session';
import { getMergedCheckoutStaffDisplayNames } from '@/lib/server/checkoutStaffAllowlist';
import { HttpError } from '@/lib/server/httpError';
import { logError } from '@/lib/server/log';

export const runtime = 'nodejs';

/** Merged checkout/cleaning staff dropdown + server validation source (legacy + Firestore employees). */
export async function GET() {
  try {
    await requireSessionApi();
    const names = await getMergedCheckoutStaffDisplayNames();
    return NextResponse.json({ names });
  } catch (err) {
    logError('api.checkins.checkout-staff-options', { message: String(err) });
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to load staff options' }, { status: 500 });
  }
}
