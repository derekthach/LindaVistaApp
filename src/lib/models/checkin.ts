import { DateTime } from 'luxon';
import type { Timestamp } from 'firebase-admin/firestore';
import type { CheckIn } from '@/types';

export type { CheckIn };

export interface CheckinDoc {
  receiptNumber: string;
  checkInAt: Timestamp;
  roomId: number;
  cost: number;
  paymentMethod: string;
  staffName: string;
  carPlate: string;
  carMake: string;
  carColor: string;
  note?: string;
}

export function normalizeCheckin(id: string, data: Record<string, unknown>): CheckIn {
  const checkInAt = data.checkInAt as Timestamp;
  const d = checkInAt.toDate();
  const dt = DateTime.fromJSDate(d, { zone: 'America/Puerto_Rico' });
  const date = dt.toISODate() ?? '';
  const time = dt.toFormat('HH:mm');

  return {
    id,
    checkin_id: undefined,
    receipt_number: (data.receiptNumber as string) ?? '',
    date,
    time,
    room_id: (data.roomId as number) ?? 0,
    cost: (data.cost as number) ?? 0,
    payment_method: (data.paymentMethod as 'cash' | 'ath_mobil') ?? 'cash',
    staff_name: (data.staffName as string) ?? '',
    car_plate: (data.carPlate as string) ?? '',
    car_make: (data.carMake as string) ?? '',
    car_color: (data.carColor as string) ?? '',
    note: (data.note as string) || undefined,
  };
}
