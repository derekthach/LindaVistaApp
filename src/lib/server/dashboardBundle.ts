import { DateTime } from 'luxon';
import type {
  CalendarMonthRoomTrendData,
  CheckIn,
  DashboardBundleResponse,
  DashboardData,
  EmployeeRoomActivityData,
  EmployeeRoomCountSeries,
  MonthlyComparisonData,
  RoomUsageData,
  SummaryMetrics,
} from '@/types';
import { isRoomCheckinRecord } from '@/lib/checkins/roomCheckinRecord';
import { deriveCalendarMonthRoomTrendFromCheckins } from '@/lib/dashboard/calendarMonthTrendData';
import { deriveRoomUsageForWeekFromCheckins } from '@/lib/dashboard/roomUsageWeekData';
import { deriveMotelWeekTrendComparisonFromCheckins } from '@/lib/dashboard/motelWeekTrendData';
import { deriveSummaryMetricsFromCheckins } from '@/lib/dashboard/summaryMetrics';
import {
  getMotelBusinessWeekBoundsFromStartIso,
  getMotelBusinessWeekStart,
} from '@/lib/dates/motelBusinessWeek';
import {
  getEmployeeRoomCleanupsForMonth,
  listCheckinsByDateRange,
} from '@/lib/server/checkinsRepo';
import { logInfo } from '@/lib/server/log';

const ZONE = 'America/Puerto_Rico';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function minIso(...dates: string[]): string {
  return dates.reduce((a, b) => (a <= b ? a : b));
}

function maxIso(...dates: string[]): string {
  return dates.reduce((a, b) => (a >= b ? a : b));
}

function monthIsoBounds(year: number, month: number): { startISO: string; endISO: string } {
  const start = DateTime.fromObject({ year, month, day: 1 }, { zone: ZONE }).startOf('day');
  const end = start.plus({ months: 1 }).minus({ days: 1 });
  return { startISO: start.toISODate() ?? '', endISO: end.toISODate() ?? '' };
}

/** Same bounds as getMonthlyComparison / listCheckinsByDateRange for revenue month + previous month. */
function revenueMonthBounds(month: number, year: number) {
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = year - 1;
  }
  const currentMonthStart = `${year}-${month.toString().padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStart = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;
  const prevMonthStart = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-01`;
  const currentMonthEnd =
    DateTime.fromISO(nextMonthStart, { zone: ZONE }).minus({ days: 1 }).toISODate() ?? currentMonthStart;
  const prevMonthEnd =
    DateTime.fromISO(currentMonthStart, { zone: ZONE }).minus({ days: 1 }).toISODate() ?? prevMonthStart;
  return { currentMonthStart, currentMonthEnd, prevMonthStart, prevMonthEnd, prevMonth, prevYear };
}

function sortAndLimitStaffCounts(counts: Map<string, number>, limit = 20): EmployeeRoomCountSeries {
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = entries.slice(0, limit);
  return { labels: top.map(([k]) => k), counts: top.map(([, v]) => v) };
}

/** Re-export for callers that imported summary derivation from this module. */
export { deriveSummaryMetricsFromCheckins } from '@/lib/dashboard/summaryMetrics';

/** Re-export weekly room usage derivation for bundle callers. */
export function deriveRoomUsageFromCheckins(
  checkins: CheckIn[],
  weekStartISO: string
): RoomUsageData {
  return deriveRoomUsageForWeekFromCheckins(checkins, weekStartISO, ZONE);
}

export function deriveMonthlyComparisonFromCheckins(
  checkins: CheckIn[],
  month: number,
  year: number
): MonthlyComparisonData {
  const { currentMonthStart, currentMonthEnd, prevMonthStart, prevMonthEnd, prevMonth, prevYear } =
    revenueMonthBounds(month, year);

  const currentList = checkins.filter(
    (c) => c.date >= currentMonthStart && c.date <= currentMonthEnd
  );
  const prevList = checkins.filter((c) => c.date >= prevMonthStart && c.date <= prevMonthEnd);

  const currentRevenue = currentList.reduce((sum, c) => sum + c.cost, 0);
  const prevRevenue = prevList.reduce((sum, c) => sum + c.cost, 0);
  const currentRoomCount = currentList.filter(isRoomCheckinRecord).length;
  const prevRoomCount = prevList.filter(isRoomCheckinRecord).length;

  const years = [year, year - 1].map((y) => y.toString());

  return {
    current_month: {
      name: MONTH_NAMES[month - 1],
      year,
      total: currentRevenue,
      car_count: currentRoomCount,
    },
    prev_month: {
      name: MONTH_NAMES[prevMonth - 1],
      year: prevYear,
      total: prevRevenue,
      car_count: prevRoomCount,
    },
    years_available: years,
  };
}

export function deriveEmployeeCheckInsFromCheckins(
  checkins: CheckIn[],
  year: number,
  month: number
): EmployeeRoomCountSeries {
  const { startISO, endISO } = monthIsoBounds(year, month);
  const byStaff = new Map<string, number>();
  for (const c of checkins) {
    if (c.date < startISO || c.date > endISO) continue;
    if (!isRoomCheckinRecord(c)) continue;
    const name = (c.staff_name ?? '').trim() || 'Unknown';
    byStaff.set(name, (byStaff.get(name) ?? 0) + 1);
  }
  return sortAndLimitStaffCounts(byStaff);
}

/**
 * Dashboard bundle intentionally reads check-ins once and derives multiple dashboard widgets in memory
 * to reduce duplicate Firestore document reads.
 */
export async function getDashboardBundle(params: {
  roomWeekStart: string;
  revenueMonth: number;
  revenueYear: number;
}): Promise<DashboardBundleResponse> {
  const started = Date.now();
  const now = DateTime.now().setZone(ZONE);
  const todayISO = now.toISODate() ?? '';

  const weekStart = getMotelBusinessWeekStart(now, ZONE);
  const prevWeekStart = weekStart.minus({ days: 7 });

  const roomWeekStartISO =
    getMotelBusinessWeekStart(
      DateTime.fromISO(params.roomWeekStart, { zone: ZONE }),
      ZONE
    ).toISODate() ?? params.roomWeekStart;
  const { startISO: roomWeekStartBound, endISO: roomWeekEndBound } =
    getMotelBusinessWeekBoundsFromStartIso(roomWeekStartISO, ZONE);

  const { currentMonthStart, currentMonthEnd, prevMonthStart, prevMonthEnd } = revenueMonthBounds(
    params.revenueMonth,
    params.revenueYear
  );

  /** Ensures the in-memory list includes the full PR calendar month for “this month” charts even when other widgets use narrower ranges. */
  const calendarMonthStart = now.startOf('month').toISODate() ?? '';
  /** Prior calendar month (PR) for monthly trend comparison vs revenue widget’s `prevMonthStart`. */
  const calendarPrevMonthStart = now.startOf('month').minus({ months: 1 }).toISODate() ?? '';
  const calendarPrevMonthEnd =
    now.startOf('month').minus({ days: 1 }).toISODate() ?? calendarPrevMonthStart;

  const starts = [
    prevWeekStart.toISODate() ?? '',
    calendarMonthStart,
    calendarPrevMonthStart,
    roomWeekStartBound,
    currentMonthStart,
    prevMonthStart,
  ];
  const ends = [
    todayISO,
    roomWeekEndBound,
    currentMonthEnd,
    prevMonthEnd,
    calendarPrevMonthEnd,
  ];

  const unionStart = minIso(...starts);
  const unionEnd = maxIso(...ends);

  let checkins: CheckIn[] = [];
  try {
    checkins = await listCheckinsByDateRange(unionStart, unionEnd);
  } catch {
    checkins = [];
  }

  let summaryMetrics: SummaryMetrics = {
    carsToday: 0,
    carsThisWeek: 0,
    profitToday: 0,
    profitThisWeek: 0,
    todayCarsDeltaVsYesterday: 0,
    todayRevenueDeltaVsYesterday: 0,
    weekCarsDeltaVsPrior: 0,
    weekRevenueDeltaVsPrior: 0,
  };
  let sevenDayTrend: DashboardData = {
    dates: [],
    trendAxisIsos: [],
    checkins: [],
    revenue: [],
    checkinsPrevWeek: [],
    revenuePrevWeek: [],
  };
  let calendarMonthRoomTrend: CalendarMonthRoomTrendData = deriveCalendarMonthRoomTrendFromCheckins(
    [],
    now,
    ZONE
  );
  let monthlyRevenue: MonthlyComparisonData;
  let roomUsage: RoomUsageData = { room_numbers: [], usage_counts: [] };
  let employeeRoomActivity: EmployeeRoomActivityData = {
    check_ins: { labels: [], counts: [] },
    cleanups: { labels: [], counts: [] },
  };

  try {
    summaryMetrics = deriveSummaryMetricsFromCheckins(checkins, now);
  } catch (e) {
    console.warn('[dashboard-bundle] summary metrics derivation failed', e);
  }

  try {
    sevenDayTrend = deriveMotelWeekTrendComparisonFromCheckins(checkins, now, ZONE);
  } catch (e) {
    console.warn('[dashboard-bundle] seven-day trend derivation failed', e);
  }

  try {
    calendarMonthRoomTrend = deriveCalendarMonthRoomTrendFromCheckins(checkins, now, ZONE);
  } catch (e) {
    console.warn('[dashboard-bundle] calendar month room trend derivation failed', e);
    calendarMonthRoomTrend = deriveCalendarMonthRoomTrendFromCheckins([], now, ZONE);
  }

  try {
    monthlyRevenue = deriveMonthlyComparisonFromCheckins(
      checkins,
      params.revenueMonth,
      params.revenueYear
    );
  } catch (e) {
    console.warn('[dashboard-bundle] monthly revenue derivation failed', e);
    const { prevMonth, prevYear } = revenueMonthBounds(params.revenueMonth, params.revenueYear);
    monthlyRevenue = {
      current_month: {
        name: MONTH_NAMES[params.revenueMonth - 1],
        year: params.revenueYear,
        total: 0,
        car_count: 0,
      },
      prev_month: {
        name: MONTH_NAMES[prevMonth - 1],
        year: prevYear,
        total: 0,
        car_count: 0,
      },
      years_available: [String(params.revenueYear)],
    };
  }

  try {
    roomUsage = deriveRoomUsageForWeekFromCheckins(checkins, roomWeekStartISO, ZONE);
  } catch (e) {
    console.warn('[dashboard-bundle] room usage derivation failed', e);
  }

  try {
    const check_ins = deriveEmployeeCheckInsFromCheckins(
      checkins,
      params.revenueYear,
      params.revenueMonth
    );
    let cleanups: EmployeeRoomCountSeries = { labels: [], counts: [] };
    try {
      cleanups = await getEmployeeRoomCleanupsForMonth(params.revenueYear, params.revenueMonth);
    } catch (e) {
      console.warn('[dashboard-bundle] cleanups query failed', e);
    }
    employeeRoomActivity = { check_ins, cleanups };
  } catch (e) {
    console.warn('[dashboard-bundle] employee activity derivation failed', e);
  }

  logInfo('dashboard.bundle.complete', {
    docsReturned: checkins.length,
    rangeStart: unionStart,
    rangeEnd: unionEnd,
    roomWeekStart: roomWeekStartISO,
    revenueMonth: params.revenueMonth,
    revenueYear: params.revenueYear,
    durationMs: Date.now() - started,
  });

  return {
    summaryMetrics,
    sevenDayTrend,
    calendarMonthRoomTrend,
    monthlyRevenue,
    roomUsage,
    employeeRoomActivity,
    meta: {
      rangeStart: unionStart,
      rangeEnd: unionEnd,
      generatedAt: new Date().toISOString(),
      source: 'dashboard-bundle',
    },
  };
}
