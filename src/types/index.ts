import type { PaymentMethodValue } from '@/lib/checkins/paymentMethods';

export type UserRole = 'admin' | 'employee';

export interface User {
  username: string;
  password: string;
  role: UserRole;
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
  /** Room: multi-method splits (authoritative total with cost when present). */
  payment_splits?: RoomPaymentSplit[];
  /** Room: optional denormalized total from Firestore (same as cost for split records). */
  total_collected?: number;
  staff_name: string;
  /** Firestore: employeeId (staff user doc id) when set. */
  employee_id?: string;
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
  /** Room: ISO timestamp string (America/Puerto_Rico) when guest checkout recorded. */
  checked_out_at?: string;
  /** Room: ISO timestamp when room marked cleaned/ready (same as checkout for now). */
  cleaned_at?: string;
  /** Room: staff who performed checkout action. */
  checked_out_by?: string;
  /** Room: staff who cleaned / verified room ready. */
  cleaned_by?: string;
}

export interface SummaryMetrics {
  carsToday: number;
  carsThisWeek: number;
  profitToday: number;
  profitThisWeek: number;
}

export interface DashboardData {
  dates: string[];
  checkins: number[];
  revenue: number[];
}

export interface RoomUsageData {
  room_numbers: string[];
  usage_counts: number[];
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
