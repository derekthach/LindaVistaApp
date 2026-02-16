import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth/session';
import { getMonthlyComparison } from '@/lib/server/checkinsRepo';
import { logError, logInfo } from '@/lib/server/log';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';
import { requireEnvs } from '@/lib/server/requireEnv';

export const runtime = 'nodejs';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function emptyMonthlyData(month: number, year: number) {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return {
    current_month: { name: MONTH_NAMES[month - 1], year, total: 0, car_count: 0 },
    prev_month: { name: MONTH_NAMES[prevMonth - 1], year: prevYear, total: 0, car_count: 0 },
    years_available: [String(year)],
  };
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  logInfo('api.monthly-revenue.start', { requestId });

  try {
    if (process.env.NODE_ENV === 'production') {
      requireEnvs(['SESSION_SECRET']);
    }
    await requireAuth('admin');
    const searchParams = request.nextUrl.searchParams;
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1), 10);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
    const data = await getMonthlyComparison(month, year);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof HttpError) {
      logError('api.monthly-revenue.error', { requestId, message: String(err) });
      const { status, body } = toErrorResponse(err, requestId);
      return NextResponse.json(body, { status });
    }
    logError('api.monthly-revenue.error', { requestId, message: String(err) });
    const month = parseInt(request.nextUrl.searchParams.get('month') || String(new Date().getMonth() + 1), 10);
    const year = parseInt(request.nextUrl.searchParams.get('year') || String(new Date().getFullYear()), 10);
    return NextResponse.json(emptyMonthlyData(month, year));
  }
}
