import { NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { requireAuth } from '@/server/auth/session';
import { getDashboardBundle } from '@/lib/server/dashboardBundle';
import { logError, logInfo } from '@/lib/server/log';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';
import { requireEnvs } from '@/lib/server/requireEnv';

export const runtime = 'nodejs';

const ZONE = 'America/Puerto_Rico';

function parseIntParam(value: string | null, fallback: number): number {
  if (value == null || value === '') return fallback;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Dashboard bundle intentionally reads check-ins once and derives multiple dashboard widgets in memory
 * to reduce duplicate Firestore document reads.
 */
export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  logInfo('api.dashboard.bundle.start', { requestId });

  try {
    if (process.env.NODE_ENV === 'production') {
      requireEnvs(['SESSION_SECRET']);
    }
    await requireAuth('admin');

    const { searchParams } = new URL(request.url);
    const nowPr = DateTime.now().setZone(ZONE);

    const roomMonth = parseIntParam(searchParams.get('roomMonth'), nowPr.month);
    const roomYear = parseIntParam(searchParams.get('roomYear'), nowPr.year);
    const revenueMonth = parseIntParam(searchParams.get('revenueMonth'), new Date().getMonth() + 1);
    const revenueYear = parseIntParam(searchParams.get('revenueYear'), new Date().getFullYear());

    const payload = await getDashboardBundle({
      roomMonth,
      roomYear,
      revenueMonth,
      revenueYear,
    });
    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof HttpError) {
      logError('api.dashboard.bundle.error', { requestId, message: String(err) });
      const { status, body } = toErrorResponse(err, requestId);
      return NextResponse.json(body, { status });
    }
    logError('api.dashboard.bundle.error', { requestId, message: String(err) });
    const nowPr = DateTime.now().setZone(ZONE);
    return NextResponse.json(
      {
        summaryMetrics: {
          carsToday: 0,
          carsThisWeek: 0,
          profitToday: 0,
          profitThisWeek: 0,
          todayCarsDeltaVsYesterday: 0,
          todayRevenueDeltaVsYesterday: 0,
          weekCarsDeltaVsPrior: 0,
          weekRevenueDeltaVsPrior: 0,
        },
        sevenDayTrend: {
          dates: [],
          trendAxisIsos: [],
          checkins: [],
          revenue: [],
          checkinsPrevWeek: [],
          revenuePrevWeek: [],
        },
        monthlyRevenue: {
          current_month: { name: '', year: nowPr.year, total: 0, car_count: 0 },
          prev_month: { name: '', year: nowPr.year, total: 0, car_count: 0 },
          years_available: [String(nowPr.year)],
        },
        roomUsage: { room_numbers: [], usage_counts: [] },
        employeeRoomActivity: {
          check_ins: { labels: [], counts: [] },
          cleanups: { labels: [], counts: [] },
        },
        meta: {
          rangeStart: '',
          rangeEnd: '',
          generatedAt: new Date().toISOString(),
          source: 'dashboard-bundle' as const,
        },
      },
      { status: 200 }
    );
  }
}
