import { DateTime } from 'luxon';
import type { Timestamp } from 'firebase-admin/firestore';
import type { CheckIn, CheckInType, LineItem, SummarizedItem } from '@/types';
import { normalizePaymentMethod } from '@/lib/checkins/paymentMethods';

export type { CheckIn };

export interface CheckinDoc {
  receiptNumber?: string;
  receiptNo?: string;
  checkInAt: Timestamp;
  checkInType?: CheckInType;
  roomId?: number;
  cost?: number;
  paymentMethod?: string;
  staffName?: string;
  staffId?: string;
  carPlate?: string;
  carMake?: string;
  carColor?: string;
  note?: string;
  lineItems?: LineItem[];
  summarizedItems?: SummarizedItem[];
}

/** Compute total amount collected for food/beer from summarizedItems or lineItems. */
function totalAmountCollected(data: Record<string, unknown>): number {
  const summarized = data.summarizedItems as SummarizedItem[] | undefined;
  if (Array.isArray(summarized) && summarized.length > 0) {
    return summarized.reduce((sum, s) => sum + (Number(s.totalAmountCollected) || 0), 0);
  }
  const lineItems = data.lineItems as LineItem[] | undefined;
  if (Array.isArray(lineItems) && lineItems.length > 0) {
    return lineItems.reduce((sum, l) => sum + (Number(l.amountCollected) || 0), 0);
  }
  return 0;
}

export function normalizeCheckin(id: string, data: Record<string, unknown>): CheckIn {
  const checkInAt = data.checkInAt as Timestamp | undefined;
  const d = checkInAt?.toDate?.() ?? new Date();
  const dt = DateTime.fromJSDate(d, { zone: 'America/Puerto_Rico' });
  const date = dt.toISODate() ?? '';
  const time = dt.toFormat('HH:mm');
  const checkInType = (data.checkInType as CheckInType) ?? 'room';
  const rawLineItems = data.lineItems as LineItem[] | undefined;
  const lineItems = Array.isArray(rawLineItems) ? rawLineItems : undefined;
  const rawSummarized = data.summarizedItems as SummarizedItem[] | undefined;
  const summarizedItems = Array.isArray(rawSummarized) ? rawSummarized : undefined;

  const isRoom = checkInType === 'room';
  const receiptNumber =
    (data.receiptNumber as string) ?? (data.receiptNo as string) ?? '';
  const staffName =
    (data.staffName as string) ?? (data.staffId as string) ?? '';
  const cost = isRoom
    ? (Number(data.cost) || 0)
    : totalAmountCollected(data);

  const paymentRaw = (data.paymentMethod ?? data.payment) as string | undefined;
  const paymentMethod = normalizePaymentMethod(paymentRaw);
  const noteRaw = (data.note ?? data.notes) as string | undefined;
  const note = typeof noteRaw === 'string' && noteRaw.trim() ? noteRaw.trim() : undefined;

  return {
    id,
    checkin_id: undefined,
    checkInType,
    receipt_number: String(receiptNumber),
    date,
    time,
    room_id: isRoom ? (Number(data.roomId) || 0) : 0,
    cost,
    payment_method: paymentMethod,
    staff_name: String(staffName),
    car_plate: (data.carPlate as string) ?? '',
    car_make: (data.carMake as string) ?? '',
    car_color: (data.carColor as string) ?? '',
    note,
    lineItems,
    summarizedItems,
  };
}
