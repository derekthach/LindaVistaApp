import { Timestamp } from 'firebase-admin/firestore';
import { DateTime } from 'luxon';
import { getAdminDb } from './firebaseAdmin';
import { normalizeCheckin } from '@/lib/models/checkin';
import type {
  CheckIn,
  SummaryMetrics,
  DashboardData,
  RoomUsageData,
  MonthlyComparisonData,
} from '@/types';

const CHECKINS_COLLECTION = 'checkins';
const COUNTERS_COLLECTION = 'counters';
const RECEIPT_COUNTER_ID = 'receipt';

export type CreateCheckinInput = Omit<CheckIn, 'checkin_id'>;

export async function createCheckin(data: CreateCheckinInput): Promise<string> {
  const db = getAdminDb();
  const counterRef = db.collection(COUNTERS_COLLECTION).doc(RECEIPT_COUNTER_ID);
  const checkinsRef = db.collection(CHECKINS_COLLECTION);

  const result = await db.runTransaction(async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const nextNum = counterSnap.exists
      ? (counterSnap.data()?.nextReceiptNumber as number) ?? 1
      : 1;
    const receiptNumber = nextNum.toString().padStart(4, '0');

    const dt = DateTime.fromFormat(
      `${data.date} ${data.time}`,
      'yyyy-MM-dd HH:mm',
      { zone: 'America/Puerto_Rico' }
    );
    const checkInAt = dt.isValid ? Timestamp.fromDate(dt.toJSDate()) : Timestamp.now();

    const doc = {
      receiptNumber,
      checkInAt,
      roomId: data.room_id,
      cost: data.cost,
      paymentMethod: data.payment_method,
      staffName: data.staff_name,
      carPlate: data.car_plate,
      carMake: data.car_make,
      carColor: data.car_color,
      note: data.note ?? '',
    };

    tx.set(counterRef, { nextReceiptNumber: nextNum + 1 }, { merge: true });
    const newRef = checkinsRef.doc();
    tx.set(newRef, doc);
    return { id: newRef.id, receiptNumber };
  });

  return result.receiptNumber;
}

export async function getNextReceiptNumber(): Promise<string> {
  const db = getAdminDb();
  const counterRef = db.collection(COUNTERS_COLLECTION).doc(RECEIPT_COUNTER_ID);
  const snap = await counterRef.get();
  const nextNum = snap.exists
    ? (snap.data()?.nextReceiptNumber as number) ?? 1
    : 1;
  return nextNum.toString().padStart(4, '0');
}

function startOfDayISO(isoDate: string): Date {
  const dt = DateTime.fromISO(isoDate, { zone: 'America/Puerto_Rico' }).startOf('day');
  return dt.toJSDate();
}

function endExclusiveISO(isoDate: string): Date {
  const dt = DateTime.fromISO(isoDate, { zone: 'America/Puerto_Rico' })
    .plus({ days: 1 })
    .startOf('day');
  return dt.toJSDate();
}

/**
 * List check-ins in a date range. Dates are YYYY-MM-DD and interpreted in America/Puerto_Rico.
 * For a single calendar day, pass the same ISO date for both startISO and endISO
 * (e.g. listCheckinsByDateRange('2026-02-15', '2026-02-15')).
 */
export async function listCheckinsByDateRange(
  startISO?: string,
  endISO?: string
): Promise<CheckIn[]> {
  const db = getAdminDb();
  const now = DateTime.now().setZone('America/Puerto_Rico');
  const start = startISO
    ? Timestamp.fromDate(startOfDayISO(startISO))
    : Timestamp.fromDate(new Date(0));
  const endExclusive = endISO
    ? Timestamp.fromDate(endExclusiveISO(endISO))
    : Timestamp.fromDate(now.plus({ days: 1 }).startOf('day').toJSDate());

  const snapshot = await db
    .collection(CHECKINS_COLLECTION)
    .where('checkInAt', '>=', start)
    .where('checkInAt', '<', endExclusive)
    .orderBy('checkInAt', 'desc')
    .get();

  return snapshot.docs.map((doc) => normalizeCheckin(doc.id, doc.data()));
}

export async function deleteCheckinById(id: string): Promise<void> {
  const db = getAdminDb();
  const ref = db.collection(CHECKINS_COLLECTION).doc(id);
  await ref.delete();
}

const ZONE = 'America/Puerto_Rico';

export async function getSummaryMetrics(): Promise<SummaryMetrics> {
  const now = DateTime.now().setZone(ZONE);
  const todayISO = now.toISODate() ?? '';
  const startOfWeekISO = now.startOf('week').toISODate() ?? '';

  const [todayCheckins, weekCheckins] = await Promise.all([
    listCheckinsByDateRange(todayISO, todayISO),
    listCheckinsByDateRange(startOfWeekISO, todayISO),
  ]);

  const profitToday = todayCheckins.reduce((sum, c) => sum + c.cost, 0);
  const profitThisWeek = weekCheckins.reduce((sum, c) => sum + c.cost, 0);

  return {
    carsToday: todayCheckins.length,
    carsThisWeek: weekCheckins.length,
    profitToday,
    profitThisWeek,
  };
}

export async function get7DayTrends(): Promise<DashboardData> {
  const endDate = DateTime.now().setZone(ZONE);
  const startDate = endDate.minus({ days: 6 });
  const startISO = startDate.toISODate() ?? '';
  const endISO = endDate.toISODate() ?? '';

  const checkins = await listCheckinsByDateRange(startISO, endISO);
  const byDay = new Map<string, { count: number; revenue: number }>();

  let current = startDate;
  while (current <= endDate) {
    const key = current.toISODate() ?? '';
    byDay.set(key, { count: 0, revenue: 0 });
    current = current.plus({ days: 1 });
  }

  for (const c of checkins) {
    const key = c.date;
    const cell = byDay.get(key);
    if (cell) {
      cell.count += 1;
      cell.revenue += c.cost;
    }
  }

  const dates: string[] = [];
  const checkinsArr: number[] = [];
  const revenue: number[] = [];
  current = startDate;
  while (current <= endDate) {
    dates.push(current.toFormat('MM/dd'));
    const key = current.toISODate() ?? '';
    const cell = byDay.get(key) ?? { count: 0, revenue: 0 };
    checkinsArr.push(cell.count);
    revenue.push(cell.revenue);
    current = current.plus({ days: 1 });
  }

  return { dates, checkins: checkinsArr, revenue };
}

export async function getRoomUsageTop15(): Promise<RoomUsageData> {
  const checkins = await listCheckinsByDateRange();
  const byRoom = new Map<number, number>();
  for (const c of checkins) {
    byRoom.set(c.room_id, (byRoom.get(c.room_id) ?? 0) + 1);
  }
  const sorted = [...byRoom.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  return {
    room_numbers: sorted.map(([id]) => `Room ${id}`),
    usage_counts: sorted.map(([, count]) => count),
  };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export async function getMonthlyComparison(
  month: number,
  year: number
): Promise<MonthlyComparisonData> {
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

  const currentMonthEnd = DateTime.fromISO(nextMonthStart, { zone: ZONE }).minus({ days: 1 }).toISODate() ?? currentMonthStart;
  const prevMonthEnd = DateTime.fromISO(currentMonthStart, { zone: ZONE }).minus({ days: 1 }).toISODate() ?? prevMonthStart;

  const [currentCheckins, prevCheckins] = await Promise.all([
    listCheckinsByDateRange(currentMonthStart, currentMonthEnd),
    listCheckinsByDateRange(prevMonthStart, prevMonthEnd),
  ]);

  const currentRevenue = currentCheckins.reduce((sum, c) => sum + c.cost, 0);
  const prevRevenue = prevCheckins.reduce((sum, c) => sum + c.cost, 0);

  const years = [year, year - 1].map((y) => y.toString());

  return {
    current_month: {
      name: MONTH_NAMES[month - 1],
      year,
      total: currentRevenue,
      car_count: currentCheckins.length,
    },
    prev_month: {
      name: MONTH_NAMES[prevMonth - 1],
      year: prevYear,
      total: prevRevenue,
      car_count: prevCheckins.length,
    },
    years_available: years,
  };
}
