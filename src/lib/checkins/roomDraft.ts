import { CAR_COLORS } from '@/lib/checkins/colors';
import { roundMoney, validatePaymentSplits } from '@/lib/checkins/roomPaymentSplits';
import { parseRoomOptionValue, type RoomId } from '@/lib/checkins/rooms';
import { isValidRoomSubmissionKey } from '@/lib/checkins/roomSubmissionKey';

/**
 * Same key as verify (`VerifyCheckinForm`) and `CheckinForm` submit — one serialized payload for room → review → confirm.
 */
export const ROOM_CHECKIN_SESSION_STORAGE_KEY = 'checkinData';

export type RoomCheckinPaymentRowDraft = { method: string; amount: string };

/** Shape passed into `CheckinForm` to restore after returning from review (sessionStorage). */
export type RoomCheckinDraftRestore = {
  room_id: RoomId | '';
  receipt_number: string;
  date: string;
  time: string;
  car_plate: string;
  car_make: string;
  car_color: string;
  staff_name: string;
  note: string;
  paymentRows: RoomCheckinPaymentRowDraft[];
};

export function clearRoomCheckinSessionDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(ROOM_CHECKIN_SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

const VALID_COLOR_KEYS = new Set(CAR_COLORS.map((c) => c.key));

function normalizeCarColorKey(raw: string): string {
  const s = raw.trim();
  if (VALID_COLOR_KEYS.has(s)) return s;
  return CAR_COLORS[0]?.key ?? 'black';
}

function amountToInputString(amount: number): string {
  const r = roundMoney(amount);
  if (!Number.isFinite(r)) return '';
  if (Math.abs(r - Math.round(r)) < 1e-9) return String(Math.round(r));
  return r.toFixed(2);
}

/**
 * If `sessionStorage` holds a valid room verify payload, parse it for form restore.
 * Returns `null` when there is nothing to restore or the payload is invalid/legacy.
 */
export function readRoomCheckinDraftFromSession(): RoomCheckinDraftRestore | null {
  if (typeof window === 'undefined') return null;
  let raw: string;
  try {
    raw = sessionStorage.getItem(ROOM_CHECKIN_SESSION_STORAGE_KEY) ?? '';
  } catch {
    return null;
  }
  if (!raw.trim()) return null;

  let record: Record<string, string>;
  try {
    record = JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }

  if (!isValidRoomSubmissionKey(record.submission_key)) return null;
  if (!record.payment_splits?.trim()) return null;

  const splitResult = validatePaymentSplits(record.payment_splits);
  if (!splitResult.valid || !splitResult.splits?.length) return null;

  const roomRaw = String(record.room_id ?? '').trim();
  if (!roomRaw) return null;
  const room_id = parseRoomOptionValue(roomRaw);

  const paymentRows: RoomCheckinPaymentRowDraft[] = splitResult.splits.map((s) => ({
    method: s.method,
    amount: amountToInputString(s.amount),
  }));

  return {
    room_id,
    receipt_number: String(record.receipt_number ?? ''),
    date: String(record.date ?? ''),
    time: String(record.time ?? ''),
    car_plate: String(record.car_plate ?? ''),
    car_make: String(record.car_make ?? ''),
    car_color: normalizeCarColorKey(String(record.car_color ?? '')),
    staff_name: String(record.staff_name ?? ''),
    note: String(record.note ?? ''),
    paymentRows,
  };
}
