import type { PaymentMethodValue } from '@/lib/checkins/paymentMethods';

export type UserRole = 'admin' | 'employee';

export interface User {
  username: string;
  password: string;
  role: UserRole;
  /** Optional display name for staff-facing labels (legacy `users.json` accounts). */
  name?: string;
  /** When true, user is sent to `/employee/change-password` until a new password is saved. */
  mustChangePassword?: boolean;
}

export interface SessionData {
  username: string;
  role: UserRole;
  isLoggedIn: boolean;
  /** Firestore `users` document id; omitted for legacy JSON login users. */
  userId?: string;
  /** Staff-facing display string (matches STAFF_MEMBERS / checkout). */
  displayName?: string;
  mustChangePassword?: boolean;
  /** Unix ms — absolute end of session (employee 4h, admin 12h). */
  hardExpiresAt?: number;
  /** Unix ms — last request activity for inactivity logout. */
  lastActivityAt?: number;
}

export type CheckInType = 'room' | 'food' | 'beer';

/** Room split payment row (Firestore: paymentSplits). */
export type RoomPaymentSplit = { method: PaymentMethodValue; amount: number };

/** Line item for food/beer check-ins (stable itemId + snapshot label). Raw row as entered by staff. */
export interface LineItem {
  itemId: string;
  itemLabel: string;
  quantitySold: number;
  amountCollected: number;
}

/** Aggregated totals by itemId for a food/beer check-in. */
export interface SummarizedItem {
  itemId: string;
  itemLabel: string;
  totalQuantitySold: number;
  totalAmountCollected: number;
}

export interface CheckIn {
  id?: string;
  checkin_id?: number;
  /** When present, distinguishes room vs food/beer. Omitted on legacy docs (treated as room). */
  checkInType?: CheckInType;
  receipt_number: string;
  date: string;
  time: string;
  room_id: number | string;
  cost: number;
  /** Room: legacy single method when payment_splits is absent. */
  payment_method: string;
  /** Multi-method payment splits (room, and food/beer when saved with splits). */
  payment_splits?: RoomPaymentSplit[];
  /** Denormalized total from splits when present (room; optional on food/beer). */
  total_collected?: number;
  staff_name: string;
  /** Firestore: employeeId (staff user doc id) when set. */
  employee_id?: string;
  /** Firestore: login username at create time (e.g. `guest`); set for employee-created rows. */
  created_by_username?: string;
  /** Denormalized label at create time. */
  employee_name_snapshot?: string;
  created_by_role?: UserRole;
  car_plate: string;
  car_make: string;
  car_color: string;
  note?: string;
  /** Food/beer only. Raw line items as entered (order preserved, duplicates allowed). */
  lineItems?: LineItem[];
  /** Food/beer only. Aggregated totals by itemId. */
  summarizedItems?: SummarizedItem[];
  /** Room: false = active stay awaiting checkout; true = checked out; omitted on legacy docs. */
  is_checked_out?: boolean;
  /** Room: display timestamp (America/Puerto_Rico) when guest checkout recorded. */
  checked_out_at?: string;
  /** Room: display timestamp when room marked cleaned/ready (same as checkout for now). */
  cleaned_at?: string;
  /** Room: absolute ISO-8601 checkout instant for calculations (Shift Summaries, etc.). */
  checked_out_at_iso?: string;
  /** Room: absolute ISO-8601 cleaned instant for calculations (Shift Summaries turnover). */
  cleaned_at_iso?: string;
  /** Room: staff who performed checkout action. */
  checked_out_by?: string;
  /** Room: staff who cleaned / verified room ready. */
  cleaned_by?: string;
  /** Admin-added historical room stay: counts in reports but excluded from occupancy/checkout/cleaning. */
  is_past_entry?: boolean;
  /** Firestore `source` when set (e.g. admin_past_room_checkin, admin_past_entry). */
  past_entry_source?: string;
  /** When the admin saved this record (America/Puerto_Rico display string). */
  past_entry_system_created_at?: string;
}

export interface SummaryMetrics {
  carsToday: number;
  carsThisWeek: number;
  profitToday: number;
  profitThisWeek: number;
  /** Room count vs yesterday 12:00 a.m. through same clock time (current − prior). */
  todayCarsDeltaVsYesterday: number;
  /** Revenue vs yesterday same window (dollars, not a ratio). */
  todayRevenueDeltaVsYesterday: number;
  /** Room count vs prior motel week at same elapsed time (this week count − prior). */
  weekCarsDeltaVsPrior: number;
  /** Revenue vs prior motel week at same elapsed time (dollars, not a ratio). */
  weekRevenueDeltaVsPrior: number;
}

export interface DashboardData {
  dates: string[];
  /** YYYY-MM-DD for each x-axis step (Fri→Thu of current motel week); use for localized weekday labels */
  trendAxisIsos: string[];
  checkins: number[];
  revenue: number[];
  /** Prior motel week (Fri→Thu), aligned by day index with `dates` */
  checkinsPrevWeek: number[];
  revenuePrevWeek: number[];
}

export interface RoomUsageData {
  room_numbers: string[];
  usage_counts: number[];
  /** Fri ISO (PR motel week) for the selected range */
  week_start?: string;
  /** Thu ISO (PR motel week) for the selected range */
  week_end?: string;
  /** Highest usage count in the result set (for chart axis scaling) */
  max_count?: number;
}

/** Bar chart series: staff display names and integer counts (room check-ins or cleanups). */
export interface EmployeeRoomCountSeries {
  labels: string[];
  counts: number[];
}

export interface EmployeeRoomActivityData {
  check_ins: EmployeeRoomCountSeries;
  cleanups: EmployeeRoomCountSeries;
}

export interface MonthlyComparisonData {
  current_month: {
    name: string;
    year: number;
    total: number;
    car_count: number;
  };
  prev_month: {
    name: string;
    year: number;
    total: number;
    car_count: number;
  };
  years_available: string[];
}

/** Calendar month (America/Puerto_Rico): one point per day for the month containing bundle `now`. */
export interface CalendarMonthRoomTrendData {
  trendAxisIsos: string[];
  roomCheckins: number[];
  roomRevenue: number[];
  /** Same length as `roomCheckins`; day *k* of prior calendar month vs day *k* of current month (0 if no such day). */
  roomCheckinsPrevMonth: number[];
  roomRevenuePrevMonth: number[];
}

/** Single-response dashboard payload (one check-in read range + optional cleanups query). */
export interface DashboardBundleResponse {
  summaryMetrics: SummaryMetrics;
  sevenDayTrend: DashboardData;
  calendarMonthRoomTrend: CalendarMonthRoomTrendData;
  monthlyRevenue: MonthlyComparisonData;
  roomUsage: RoomUsageData;
  employeeRoomActivity: EmployeeRoomActivityData;
  meta: {
    rangeStart: string;
    rangeEnd: string;
    generatedAt: string;
    source: 'dashboard-bundle';
  };
}
