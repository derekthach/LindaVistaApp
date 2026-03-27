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
  car_plate: string;
  car_make: string;
  car_color: string;
  note?: string;
  /** Food/beer only. Raw line items as entered (order preserved, duplicates allowed). */
  lineItems?: LineItem[];
  /** Food/beer only. Aggregated totals by itemId. */
  summarizedItems?: SummarizedItem[];
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
