import { CAR_MAKE_MAX } from '@/lib/checkins/carMakeNormalize';
import { isValidCarColorKey } from '../colors';
import { normalizeReceiptNumber } from '../receipt';
import { PAYMENT_METHODS } from '../paymentMethods';
import { isValidRoomId } from '../rooms';
import { validatePaymentSplits } from '../roomPaymentSplits';
import type { RoomPaymentSplit } from '@/types';

export interface RoomCheckinPayload {
  room_id: number | string;
  receipt_number: string;
  date: string;
  time: string;
  cost: number;
  payment_method: string;
  payment_splits?: RoomPaymentSplit[];
  car_plate: string;
  car_make: string;
  car_color: string;
  staff_name: string;
  note?: string;
}

export interface RoomCheckinValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof RoomCheckinPayload | 'payment_splits', string>>;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_24 = /^([01]?\d|2[0-3]):[0-5]\d$/;
const LICENSE_PLATE = /^[A-Za-z0-9\- ]+$/;
const COST_MAX = 1000;
const NOTE_MAX = 500;
const PLATE_MAX = 10;


/** Normalize receipt to 5 digits (pad with zeros). Returns null if not a valid number in 0–99999. Re-export for backward compatibility. */
export const normalizeReceipt = normalizeReceiptNumber;

/**
 * Strict server-side validation for room check-in.
 * All fields required except note. Enforces format and ranges.
 */
export function validateRoomCheckin(raw: Record<string, unknown>): RoomCheckinValidationResult {
  const errors: RoomCheckinValidationResult['errors'] = {};

  const roomId = raw.room_id;
  if (roomId === undefined || roomId === null || String(roomId).trim() === '') {
    errors.room_id = 'error_room_select_before_continue';
  } else if (!isValidRoomId(roomId)) {
    errors.room_id = 'error_room_invalid';
  }

  const receiptRaw = raw.receipt_number != null ? String(raw.receipt_number).trim() : '';
  if (!receiptRaw) {
    errors.receipt_number = 'error_receipt_required';
  } else {
    const normalized = normalizeReceiptNumber(receiptRaw);
    if (normalized === null) {
      errors.receipt_number = 'error_receipt_format';
    }
  }

  const date = raw.date != null ? String(raw.date).trim() : '';
  if (!date) {
    errors.date = 'requiredDate';
  } else if (!ISO_DATE.test(date)) {
    errors.date = 'error_date_invalid_format';
  }

  const time = raw.time != null ? String(raw.time).trim() : '';
  if (!time) {
    errors.time = 'requiredTime';
  } else if (!TIME_24.test(time)) {
    errors.time = 'error_time_invalid_format';
  }

  const hasSplitPayload =
    raw.payment_splits != null &&
    raw.payment_splits !== '' &&
    !(typeof raw.payment_splits === 'string' && String(raw.payment_splits).trim() === '');

  if (hasSplitPayload) {
    const splitResult = validatePaymentSplits(raw.payment_splits);
    if (!splitResult.valid) {
      errors.payment_splits = splitResult.error ?? 'error_payment_splits_generic';
    }
  } else {
    const costVal = raw.cost;
    if (costVal === undefined || costVal === null || costVal === '') {
      errors.cost = 'error_cost_required';
    } else {
      const cost = Number(costVal);
      if (Number.isNaN(cost)) {
        errors.cost = 'error_cost_number';
      } else if (cost < 0) {
        errors.cost = 'error_cost_negative';
      } else if (cost > COST_MAX) {
        errors.cost = 'error_cost_max';
      }
    }

    const payment = raw.payment_method != null ? String(raw.payment_method).trim() : '';
    if (!payment) {
      errors.payment_method = 'error_payment_method_required';
    } else if (!PAYMENT_METHODS.includes(payment as (typeof PAYMENT_METHODS)[number])) {
      errors.payment_method = 'error_payment_method_invalid';
    }
  }

  const carPlate = raw.car_plate != null ? String(raw.car_plate).trim() : '';
  if (!carPlate) {
    errors.car_plate = 'error_plate_required';
  } else {
    if (carPlate.length > PLATE_MAX) {
      errors.car_plate = 'error_plate_length';
    } else if (!LICENSE_PLATE.test(carPlate)) {
      errors.car_plate = 'error_plate_chars';
    }
  }

  const carMake = raw.car_make != null ? String(raw.car_make).trim() : '';
  if (!carMake) {
    errors.car_make = 'error_car_make_required';
  } else if (carMake.length > CAR_MAKE_MAX) {
    errors.car_make = 'error_car_make_length';
  }

  const carColor = raw.car_color != null ? String(raw.car_color).trim() : '';
  if (!carColor) {
    errors.car_color = 'error_car_color_required';
  } else if (!isValidCarColorKey(carColor)) {
    errors.car_color = 'error_car_color_invalid';
  }

  const staffName = raw.staff_name != null ? String(raw.staff_name).trim() : '';
  if (!staffName) {
    errors.staff_name = 'requiredStaff';
  }

  const note = raw.note != null ? String(raw.note).trim() : undefined;
  if (note !== undefined && note.length > NOTE_MAX) {
    errors.note = 'error_note_length';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
