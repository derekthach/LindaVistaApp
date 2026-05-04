import { DateTime } from 'luxon';
import type {
  CheckIn,
  DashboardBundleResponse,
  DashboardData,
  EmployeeRoomActivityData,
  EmployeeRoomCountSeries,
  MonthlyComparisonData,
  RoomUsageData,
  SummaryMetrics,
} from '@/types';
import {
  getEmployeeRoomCleanupsForMonth,
  isRoomCheckinRecord,
  listCheckinsByDateRange,
} from '@/lib/server/checkinsRepo';

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

export function deriveSummaryMetricsFromCheckins(checkins: CheckIn[], now: DateTime): SummaryMetrics {
  const todayISO = now.toISODate() ?? '';
  const startOfWeekISO = now.startOf('week').toISODate() ?? '';
  const todayCheckins = checkins.filter((c) => c.date === todayISO);
  const weekCheckins = checkins.filter((c) => c.date >= startOfWeekISO && c.date <= todayISO);
  const profitToday = todayCheckins.reduce((sum, c) => sum + c.cost, 0);
  const profitThisWeek = weekCheckins.reduce((sum, c) => sum + c.cost, 0);
  const roomToday = todayCheckins.filter(isRoomCheckinRecord);
  const roomWeek = weekCheckins.filter(isRoomCheckinRecord);
  return {
    carsToday: roomToday.length,
    carsThisWeek: roomWeek.length,
    profitToday,
    profitThisWeek,
  };
}

/** Matches get7DayTrends() output using pre-fetched check-ins. */
export function deriveSevenDayTrendFromCheckins(checkins: CheckIn[], now: DateTime): DashboardData {
  const endDate = now;
  /** Same window as get7DayTrends(): inclusive last 7 calendar days in PR. */
  const startDate = endDate.minus({ days: 6 });
  const startISO = startDate.toISODate() ?? '';
  const endISO = endDate.toISODate() ?? '';
  const inRange = checkins.filter((c) => c.date >= startISO && c.date <= endISO);
  const byDay = new Map<string, { count: number; revenue: number }>();
  let current = startDate;
  const end = endDate;
  while (current <= end) {
    const key = current.toISODate() ?? '';
    byDay.set(key, { count: 0, revenue: 0 });
    current = current.plus({ days: 1 });
  }
  for (const c of inRange) {
    const key = c.date;
    const cell = byDay.get(key);
    if (cell) {
      if (isRoomCheckinRecord(c)) {
        cell.count += 1;
      }
      cell.revenue += c.cost;
    }
  }
  const dates: string[] = [];
  const checkinsArr: number[] = [];
  const revenue: number[] = [];
  current = startDate;
  while (current <= end) {
    dates.push(current.toFormat('MM/dd'));
    const key = current.toISODate() ?? '';
    const cell = byDay.get(key) ?? { count: 0, revenue: 0 };
    checkinsArr.push(cell.count);
    revenue.push(cell.revenue);
    current = current.plus({ days: 1 });
  }
  return { dates, checkins: checkinsArr, revenue };
}

export function deriveRoomUsageFromCheckins(
  checkins: CheckIn[],
  year: number,
  month: number
): RoomUsageData {
  const { startISO, endISO } = monthIsoBounds(year, month);
  const byRoom = new Map<number | string, number>();
  for (const c of checkins) {
    if (c.checkInType !== 'room') continue;
    if (c.date < startISO || c.date > endISO) continue;
    const roomId = c.room_id;
    if (roomId == null || roomId === '' || (typeof roomId === 'number' && (Number.isNaN(roomId) || roomId <= 0)))
      continue;
    byRoom.set(roomId, (byRoom.get(roomId) ?? 0) + 1);
  }
  const sorted = [...byRoom.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  return {
    room_numbers: sorted.map(([id]) => `Room ${id}`),
    usage_counts: sorted.map(([, count]) => count),
  };
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
  roomMonth: number;
  roomYear: number;
  revenueMonth: number;
  revenueYear: number;
}): Promise<DashboardBundleResponse> {
  const now = DateTime.now().setZone(ZONE);
  const todayISO = now.toISODate() ?? '';

  const weekStart = now.startOf('week');
  const sevenStart = now.minus({ days: 6 });

  const roomStart = DateTime.fromObject(
    { year: params.roomYear, month: params.roomMonth, day: 1 },
    { zone: ZONE }
  ).startOf('day');
  const roomEnd = roomStart.plus({ months: 1 }).minus({ days: 1 });

  const { currentMonthStart, currentMonthEnd, prevMonthStart, prevMonthEnd } = revenueMonthBounds(
    params.revenueMonth,
    params.revenueYear
  );

  const starts = [
    weekStart.toISODate() ?? '',
    sevenStart.toISODate() ?? '',
    roomStart.toISODate() ?? '',
    currentMonthStart,
    prevMonthStart,
  ];
  const ends = [
    todayISO,
    roomEnd.toISODate() ?? '',
    currentMonthEnd,
    prevMonthEnd,
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
  };
  let sevenDayTrend: DashboardData = { dates: [], checkins: [], revenue: [] };
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
    sevenDayTrend = deriveSevenDayTrendFromCheckins(checkins, now);
  } catch (e) {
    console.warn('[dashboard-bundle] seven-day trend derivation failed', e);
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
    roomUsage = deriveRoomUsageFromCheckins(checkins, params.roomYear, params.roomMonth);
  } catch (e) {
    console.warn('[dashboard-bundle] room usage derivation failed', e);
  }

  try {
    const check_ins = deriveEmployeeCheckInsFromCheckins(
      checkins,
      params.roomYear,
      params.roomMonth
    );
    let cleanups: EmployeeRoomCountSeries = { labels: [], counts: [] };
    try {
      cleanups = await getEmployeeRoomCleanupsForMonth(params.roomYear, params.roomMonth);
    } catch (e) {
      console.warn('[dashboard-bundle] cleanups query failed', e);
    }
    employeeRoomActivity = { check_ins, cleanups };
  } catch (e) {
    console.warn('[dashboard-bundle] employee activity derivation failed', e);
  }

  return {
    summaryMetrics,
    sevenDayTrend,
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
