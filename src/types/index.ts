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

export interface CheckIn {
  checkin_id?: number;
  receipt_number: string;
  date: string;
  time: string;
  room_id: number;
  cost: number;
  payment_method: 'cash' | 'ath_mobil';
  staff_name: string;
  car_plate: string;
  car_make: string;
  car_color: string;
  note?: string;
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
