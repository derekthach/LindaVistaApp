import { DateTime } from 'luxon';
import type {
  CheckIn,
  SummaryMetrics,
  DashboardData,
  RoomUsageData,
  MonthlyComparisonData,
} from '@/types';
import { getDb } from './sqlite';
import { formatReceiptNumber, incrementReceiptNumber } from '@/lib/checkins/receipt';

const DEFAULT_RECEIPT = '00001';

export function getNextReceiptNumber() {
  const db = getDb();
  const result = db
    .prepare('SELECT setting_value FROM Settings WHERE setting_name = ?')
    .get('next_receipt_number') as { setting_value: string } | undefined;
  const value = result?.setting_value?.trim() || DEFAULT_RECEIPT;
  return formatReceiptNumber(value);
}

export function incrementReceiptNumberInDb(currentReceipt: string) {
  const db = getDb();
  const nextReceipt = incrementReceiptNumber(currentReceipt);
  db.prepare('UPDATE Settings SET setting_value = ? WHERE setting_name = ?').run(
    nextReceipt,
    'next_receipt_number'
  );
}

export function insertCheckin(data: Omit<CheckIn, 'checkin_id'>) {
  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare(
      `
        INSERT INTO CheckIns (
          room_id, receipt_number, date, time, cost, payment_method,
          car_plate, car_make, car_color, staff_name, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      data.room_id,
      data.receipt_number,
      data.date,
      data.time,
      data.cost,
      data.payment_method,
      data.car_plate,
      data.car_make,
      data.car_color,
      data.staff_name,
      data.note || ''
    );
    incrementReceiptNumberInDb(data.receipt_number);
  });
  transaction();
}

export function getSummaryMetrics(): SummaryMetrics {
  const db = getDb();
  const today = DateTime.now().setZone('America/Puerto_Rico').toISODate();
  const startOfWeek = DateTime.now()
    .setZone('America/Puerto_Rico')
    .startOf('week')
    .toISODate();

  const carsToday = db
    .prepare('SELECT COUNT(*) as count FROM CheckIns WHERE date = ?')
    .get(today) as { count: number };
  const carsThisWeek = db
    .prepare('SELECT COUNT(*) as count FROM CheckIns WHERE date BETWEEN ? AND ?')
    .get(startOfWeek, today) as { count: number };
  const profitToday = db
    .prepare('SELECT SUM(cost) as total FROM CheckIns WHERE date = ?')
    .get(today) as { total: number | null };
  const profitThisWeek = db
    .prepare('SELECT SUM(cost) as total FROM CheckIns WHERE date BETWEEN ? AND ?')
    .get(startOfWeek, today) as { total: number | null };

  return {
    carsToday: carsToday.count,
    carsThisWeek: carsThisWeek.count,
    profitToday: profitToday.total || 0,
    profitThisWeek: profitThisWeek.total || 0,
  };
}

export function get7DayTrends(): DashboardData {
  const db = getDb();
  const endDate = DateTime.now().setZone('America/Puerto_Rico');
  const startDate = endDate.minus({ days: 6 });

  const dates: string[] = [];
  const checkins: number[] = [];
  const revenue: number[] = [];

  let currentDate = startDate;
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISODate();
    dates.push(currentDate.toFormat('MM/dd'));

    const checkinsCount = db
      .prepare('SELECT COUNT(*) as count FROM CheckIns WHERE date = ?')
      .get(dateStr) as { count: number };
    const revenueSum = db
      .prepare('SELECT SUM(cost) as total FROM CheckIns WHERE date = ?')
      .get(dateStr) as { total: number | null };

    checkins.push(checkinsCount.count);
    revenue.push(revenueSum.total || 0);

    currentDate = currentDate.plus({ days: 1 });
  }

  return { dates, checkins, revenue };
}

export function getRoomUsageTop15(): RoomUsageData {
  const db = getDb();
  const results = db
    .prepare(
      `
        SELECT room_id, COUNT(*) as usage_count
        FROM CheckIns
        GROUP BY room_id
        ORDER BY usage_count DESC
        LIMIT 15
      `
    )
    .all() as Array<{ room_id: number; usage_count: number }>;

  return {
    room_numbers: results.map((r) => `Room ${r.room_id}`),
    usage_counts: results.map((r) => r.usage_count),
  };
}

export function getMonthlyComparison(
  month: number,
  year: number
): MonthlyComparisonData {
  const db = getDb();

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

  const currentRevenue = db
    .prepare('SELECT SUM(cost) as total FROM CheckIns WHERE date >= ? AND date < ?')
    .get(currentMonthStart, nextMonthStart) as { total: number | null };
  const currentCars = db
    .prepare('SELECT COUNT(*) as count FROM CheckIns WHERE date >= ? AND date < ?')
    .get(currentMonthStart, nextMonthStart) as { count: number };

  const prevRevenue = db
    .prepare('SELECT SUM(cost) as total FROM CheckIns WHERE date >= ? AND date < ?')
    .get(prevMonthStart, currentMonthStart) as { total: number | null };
  const prevCars = db
    .prepare('SELECT COUNT(*) as count FROM CheckIns WHERE date >= ? AND date < ?')
    .get(prevMonthStart, currentMonthStart) as { count: number };

  const yearsData = db
    .prepare('SELECT DISTINCT substr(date, 1, 4) as year FROM CheckIns ORDER BY date')
    .all() as Array<{ year: string }>;

  let years = yearsData.map((y) => y.year);
  if (years.length === 0) {
    years = [year.toString()];
  } else if (!years.includes(year.toString())) {
    years.push(year.toString());
    years.sort();
  }

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  return {
    current_month: {
      name: monthNames[month - 1],
      year,
      total: currentRevenue.total || 0,
      car_count: currentCars.count,
    },
    prev_month: {
      name: monthNames[prevMonth - 1],
      year: prevYear,
      total: prevRevenue.total || 0,
      car_count: prevCars.count,
    },
    years_available: years,
  };
}

export function listCheckins(startDate?: string, endDate?: string): CheckIn[] {
  const db = getDb();
  let query = 'SELECT * FROM CheckIns';
  const params: string[] = [];

  if (startDate && endDate) {
    query += ' WHERE date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  } else if (startDate) {
    query += ' WHERE date >= ?';
    params.push(startDate);
  } else if (endDate) {
    query += ' WHERE date <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY date DESC';

  return db.prepare(query).all(...params) as CheckIn[];
}

export function exportCheckinsCsv(startDate?: string, endDate?: string) {
  const checkins = listCheckins(startDate, endDate);
  const headers = [
    'Check-In ID',
    'Date',
    'Time',
    'Receipt Number',
    'Room ID',
    'Staff Name',
    'Car Plate',
    'Cost',
    'Notes',
  ];
  const rows = checkins.map((c) => [
    c.checkin_id,
    c.date,
    c.time,
    c.receipt_number,
    c.room_id,
    c.staff_name,
    c.car_plate,
    c.cost,
    c.note || '',
  ]);

  return [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join(
    '\n'
  );
}
