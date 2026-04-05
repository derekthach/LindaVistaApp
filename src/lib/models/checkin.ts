import { DateTime } from 'luxon';
import type { Timestamp } from 'firebase-admin/firestore';
import type { CheckIn, CheckInType, LineItem, RoomPaymentSplit, SummarizedItem, UserRole } from '@/types';
import { normalizePaymentMethod } from '@/lib/checkins/paymentMethods';
import {
  calculatePaymentSplitTotal,
  parsePaymentSplitsFromFirestore,
  roundMoney,
} from '@/lib/checkins/roomPaymentSplits';

export type { CheckIn };

export interface CheckinDoc {
  receiptNumber?: string;
  receiptNo?: string;
  checkInAt: Timestamp;
  checkInType?: CheckInType;
  roomId?: number | string;
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
  paymentSplits?: RoomPaymentSplit[];
  totalCollected?: number;
  isCheckedOut?: boolean;
  checkedOutAt?: Timestamp;
  cleanedAt?: Timestamp;
  checkedOutBy?: string;
  cleanedBy?: string;
  employeeId?: string;
  employeeNameSnapshot?: string;
  createdByRole?: UserRole;
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

  const paymentSplitsParsed = isRoom ? parsePaymentSplitsFromFirestore(data.paymentSplits) : undefined;
  const totalCollectedRaw =
    isRoom && data.totalCollected != null ? Number(data.totalCollected) : undefined;

  let cost: number;
  if (isRoom) {
    if (paymentSplitsParsed && paymentSplitsParsed.length > 0) {
      cost = roundMoney(calculatePaymentSplitTotal(paymentSplitsParsed));
    } else {
      cost = Number(data.cost) || 0;
    }
  } else {
    cost = totalAmountCollected(data);
  }

  const paymentRaw = (data.paymentMethod ?? data.payment) as string | undefined;
  const paymentMethod = isRoom && paymentSplitsParsed?.length
    ? paymentSplitsParsed[0].method
    : normalizePaymentMethod(paymentRaw);
  const noteRaw = (data.note ?? data.notes) as string | undefined;
  const note = typeof noteRaw === 'string' && noteRaw.trim() ? noteRaw.trim() : undefined;

  const formatCheckoutTs = (raw: unknown): string | undefined => {
    if (raw == null) return undefined;
    try {
      const d =
        typeof (raw as { toDate?: () => Date }).toDate === 'function'
          ? (raw as { toDate: () => Date }).toDate()
          : null;
      if (!d) return undefined;
      const t = DateTime.fromJSDate(d, { zone: 'America/Puerto_Rico' });
      return t.toFormat('MMM d, yyyy h:mm a');
    } catch {
      return undefined;
    }
  };

  let is_checked_out: boolean | undefined;
  let checked_out_at: string | undefined;
  let cleaned_at: string | undefined;
  let checked_out_by: string | undefined;
  let cleaned_by: string | undefined;
  if (isRoom) {
    if (data.isCheckedOut === true) {
      is_checked_out = true;
      checked_out_at = formatCheckoutTs(data.checkedOutAt);
      cleaned_at = formatCheckoutTs(data.cleanedAt ?? data.checkedOutAt);
      checked_out_by =
        typeof data.checkedOutBy === 'string' && data.checkedOutBy.trim()
          ? data.checkedOutBy.trim()
          : undefined;
      cleaned_by =
        typeof data.cleanedBy === 'string' && data.cleanedBy.trim()
          ? data.cleanedBy.trim()
          : undefined;
    } else if (data.isCheckedOut === false) {
      is_checked_out = false;
    }
  }

  const employeeId =
    typeof data.employeeId === 'string' && data.employeeId.trim() ? data.employeeId.trim() : undefined;
  const employeeNameSnapshot =
    typeof data.employeeNameSnapshot === 'string' && data.employeeNameSnapshot.trim()
      ? data.employeeNameSnapshot.trim()
      : undefined;
  const createdByRole =
    data.createdByRole === 'admin' || data.createdByRole === 'employee'
      ? (data.createdByRole as UserRole)
      : undefined;

  return {
    id,
    checkin_id: undefined,
    checkInType,
    receipt_number: String(receiptNumber),
    date,
    time,
    room_id: isRoom
      ? data.roomId != null && data.roomId !== ''
        ? typeof data.roomId === 'number'
          ? data.roomId
          : String(data.roomId)
        : 0
      : 0,
    cost,
    payment_method: paymentMethod,
    staff_name: String(staffName),
    car_plate: (data.carPlate as string) ?? '',
    car_make: (data.carMake as string) ?? '',
    car_color: (data.carColor as string) ?? '',
    note,
    lineItems,
    summarizedItems,
    ...(isRoom && paymentSplitsParsed && paymentSplitsParsed.length > 0
      ? {
          payment_splits: paymentSplitsParsed,
          total_collected:
            totalCollectedRaw != null && !Number.isNaN(totalCollectedRaw)
              ? roundMoney(totalCollectedRaw)
              : cost,
        }
      : {}),
    ...(isRoom && is_checked_out !== undefined
      ? {
          is_checked_out,
          ...(is_checked_out === true
            ? {
                checked_out_at,
                cleaned_at,
                checked_out_by,
                cleaned_by,
              }
            : {}),
        }
      : {}),
    ...(employeeId ? { employee_id: employeeId } : {}),
    ...(employeeNameSnapshot ? { employee_name_snapshot: employeeNameSnapshot } : {}),
    ...(createdByRole ? { created_by_role: createdByRole } : {}),
  };
}
