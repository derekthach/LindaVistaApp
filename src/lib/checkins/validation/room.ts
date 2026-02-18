import { isValidCarColorKey } from '../colors';

export interface RoomCheckinPayload {
  room_id: number;
  receipt_number: string;
  date: string;
  time: string;
  cost: number;
  payment_method: string;
  car_plate: string;
  car_make: string;
  car_color: string;
  staff_name: string;
  note?: string;
}

export interface RoomCheckinValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof RoomCheckinPayload, string>>;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_24 = /^([01]?\d|2[0-3]):[0-5]\d$/;
const LICENSE_PLATE = /^[A-Za-z0-9\- ]+$/;
const ROOM_MIN = 1;
const ROOM_MAX = 999;
const RECEIPT_DIGITS = 4;
const COST_MAX = 1000;
const CAR_MAKE_MAX = 30;
const NOTE_MAX = 500;
const PLATE_MAX = 10;

const PAYMENT_OPTIONS = ['cash', 'ath_mobil'] as const;

/** Normalize receipt to 4 digits (pad with zeros). Returns null if not a valid number in 0-9999. */
export function normalizeReceipt(input: string): string | null {
  const trimmed = String(input).trim();
  if (trimmed === '') return null;
  const num = parseInt(trimmed, 10);
  if (Number.isNaN(num) || num < 0 || num > 9999) return null;
  return num.toString().padStart(RECEIPT_DIGITS, '0');
}

/**
 * Strict server-side validation for room check-in.
 * All fields required except note. Enforces format and ranges.
 */
export function validateRoomCheckin(raw: Record<string, unknown>): RoomCheckinValidationResult {
  const errors: RoomCheckinValidationResult['errors'] = {};

  const roomId = raw.room_id;
  if (roomId === undefined || roomId === null) {
    errors.room_id = 'Room number is required';
  } else {
    const n = Number(roomId);
    if (Number.isNaN(n) || !Number.isInteger(n) || n < ROOM_MIN || n > ROOM_MAX) {
      errors.room_id = 'Please select a valid room';
    }
  }

  const receiptRaw = raw.receipt_number != null ? String(raw.receipt_number).trim() : '';
  if (!receiptRaw) {
    errors.receipt_number = 'Receipt number is required';
  } else {
    const normalized = normalizeReceipt(receiptRaw);
    if (normalized === null) {
      errors.receipt_number = 'Receipt must be 4 digits (0000–9999)';
    }
  }

  const date = raw.date != null ? String(raw.date).trim() : '';
  if (!date) {
    errors.date = 'Date is required';
  } else if (!ISO_DATE.test(date)) {
    errors.date = 'Invalid date format (YYYY-MM-DD)';
  }

  const time = raw.time != null ? String(raw.time).trim() : '';
  if (!time) {
    errors.time = 'Time is required';
  } else if (!TIME_24.test(time)) {
    errors.time = 'Invalid time format (HH:mm, 24-hour)';
  }

  const costVal = raw.cost;
  if (costVal === undefined || costVal === null || costVal === '') {
    errors.cost = 'Cost is required';
  } else {
    const cost = Number(costVal);
    if (Number.isNaN(cost)) {
      errors.cost = 'Cost must be a number';
    } else if (cost < 0) {
      errors.cost = 'Cost cannot be negative';
    } else if (cost > COST_MAX) {
      errors.cost = `Cost cannot exceed $${COST_MAX}`;
    }
  }

  const payment = raw.payment_method != null ? String(raw.payment_method).trim() : '';
  if (!payment) {
    errors.payment_method = 'Payment method is required';
  } else if (!PAYMENT_OPTIONS.includes(payment as (typeof PAYMENT_OPTIONS)[number])) {
    errors.payment_method = 'Invalid payment method';
  }

  const carPlate = raw.car_plate != null ? String(raw.car_plate).trim() : '';
  if (!carPlate) {
    errors.car_plate = 'License plate is required';
  } else {
    if (carPlate.length > PLATE_MAX) {
      errors.car_plate = `License plate must be ${PLATE_MAX} characters or fewer`;
    } else if (!LICENSE_PLATE.test(carPlate)) {
      errors.car_plate = 'Only letters, numbers, spaces, and hyphen allowed';
    }
  }

  const carMake = raw.car_make != null ? String(raw.car_make).trim() : '';
  if (!carMake) {
    errors.car_make = 'Car make is required';
  } else if (carMake.length > CAR_MAKE_MAX) {
    errors.car_make = `Car make must be ${CAR_MAKE_MAX} characters or fewer`;
  }

  const carColor = raw.car_color != null ? String(raw.car_color).trim() : '';
  if (!carColor) {
    errors.car_color = 'Car color is required';
  } else if (!isValidCarColorKey(carColor)) {
    errors.car_color = 'Please select a valid car color';
  }

  const staffName = raw.staff_name != null ? String(raw.staff_name).trim() : '';
  if (!staffName) {
    errors.staff_name = 'Staff name is required';
  }

  const note = raw.note != null ? String(raw.note).trim() : undefined;
  if (note !== undefined && note.length > NOTE_MAX) {
    errors.note = `Notes must be ${NOTE_MAX} characters or fewer`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
