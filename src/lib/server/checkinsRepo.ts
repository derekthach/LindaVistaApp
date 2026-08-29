import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { DateTime } from 'luxon';
import { getAdminDb } from './firebaseAdmin';
import { isFirestoreUnavailableError, isProduction } from './firestoreError';
import { compareCheckinsByCreatedAtDesc } from '@/lib/checkins/createdAtSort';
import { normalizeCheckin } from '@/lib/models/checkin';
import { formatReceiptNumber, parseReceiptNumber, RECEIPT_MAX } from '@/lib/checkins/receipt';
import type {
  CheckIn,
  CheckInType,
  LineItem,
  RoomPaymentSplit,
  SummarizedItem,
  SummaryMetrics,
  DashboardData,
  RoomUsageData,
  EmployeeRoomActivityData,
  EmployeeRoomCountSeries,
  MonthlyComparisonData,
} from '@/types';
import {
  calculatePaymentSplitTotal,
  formatPaymentBreakdownComma,
  formatPaymentBreakdownForAuditDoc,
  getRoomCollectedTotalFromDoc,
  parsePaymentSplitsFromFirestore,
  roundMoney,
} from '@/lib/checkins/roomPaymentSplits';
import {
  isActiveOccupiedRoomDoc,
  isEmployeeRoomNumberLockedForCompletedStayDoc,
  isTargetRoomAvailableForEmployeeCorrection,
  sortRoomsForDisplay,
} from '@/lib/checkins/roomOccupancy';
import { normalizePaymentMethod, hasStoredPaymentMethodSingle } from '@/lib/checkins/paymentMethods';
import { HttpError } from '@/lib/server/httpError';
import { dedupeActiveRoomStaySnapshots } from '@/lib/server/activeRoomStayDedupe';
import { logInfo } from './log';
import { isRoomCheckinRecord } from '@/lib/checkins/roomCheckinRecord';
import { getEntryCount, parseReceiptsCapturedInput } from '@/lib/checkins/entryCount';
import { deriveMotelWeekTrendComparisonFromCheckins } from '@/lib/dashboard/motelWeekTrendData';
import { deriveSummaryMetricsFromCheckins } from '@/lib/dashboard/summaryMetrics';
import { deriveRoomUsageForWeekFromCheckins } from '@/lib/dashboard/roomUsageWeekData';
import {
  getMotelBusinessWeekBoundsFromStartIso,
  getMotelBusinessWeekStart,
} from '@/lib/dates/motelBusinessWeek';
import {
  validateUpdateCheckin,
  validateUpdateFoodBeerCheckin,
} from '@/lib/checkins/validation/updateCheckin';
import { normalizeReceipt } from '@/lib/checkins/validation/room';
import { summarizeLineItems } from '@/lib/checkins/summarize';
import {
  ADMIN_LATE_BEER_ITEMS,
  ADMIN_LATE_FOOD_ITEMS,
  BEER_ITEMS,
  FOOD_ITEMS,
  extendCatalogWithStoredItems,
} from '@/lib/checkins/items';

const CHECKINS_COLLECTION = 'checkins';
/** Idempotency ledger: one doc per room check-in confirmation (client submission_key). */
const ROOM_CHECKIN_IDEMPOTENCY_COLLECTION = 'room_checkin_idempotency';
const COUNTERS_COLLECTION = 'counters';
const RECEIPT_COUNTER_ID = 'receipt';
const SETTINGS_COLLECTION = 'settings';
const RECEIPTS_DOC_ID = 'receipts';

export type CreateCheckinInput = Omit<CheckIn, 'checkin_id'>;

/**
 * Room check-in: uses the provided receipt number and updates the single source of truth
 * (settings/receipts.nextReceiptNumber) to (providedReceiptNumber + 1) so the next
 * form load shows the next receipt.
 *
 * When `submissionKey` is set (required from the verify step), the same key only ever creates
 * one stay: retries / double-clicks return the original receipt without a second write.
 */
export async function createCheckin(
  data: CreateCheckinInput,
  options?: { submissionKey?: string }
): Promise<string> {
  const db = getAdminDb();
  const settingsRef = db.collection(SETTINGS_COLLECTION).doc(RECEIPTS_DOC_ID);
  const checkinsRef = db.collection(CHECKINS_COLLECTION);

  const receiptNumber = formatReceiptNumber(data.receipt_number);
  const receiptNum = parseReceiptNumber(data.receipt_number);
  if (receiptNum < 0 || receiptNum > RECEIPT_MAX) {
    throw new Error('Invalid receipt number');
  }

  const submissionKey = options?.submissionKey?.trim();
  const idempotencyRef =
    submissionKey != null && submissionKey !== ''
      ? db.collection(ROOM_CHECKIN_IDEMPOTENCY_COLLECTION).doc(submissionKey)
      : null;

  const result = await db.runTransaction(async (tx) => {
    if (idempotencyRef) {
      const idemSnap = await tx.get(idempotencyRef);
      if (idemSnap.exists) {
        const stored = idemSnap.data()?.receiptNumber;
        if (stored != null && String(stored).trim() !== '') {
          logInfo('checkin.room.create.idempotent_hit', { submissionKey });
          return {
            receiptNumber: formatReceiptNumber(String(stored)),
            duplicate: true as const,
          };
        }
      }
    }

    const dt = DateTime.fromFormat(
      `${data.date} ${data.time}`,
      'yyyy-MM-dd HH:mm',
      { zone: 'America/Puerto_Rico' }
    );
    const checkInAt = dt.isValid ? Timestamp.fromDate(dt.toJSDate()) : Timestamp.now();

    const splits = data.payment_splits;
    const hasSplits = Array.isArray(splits) && splits.length > 0;
    const totalCollected = hasSplits
      ? roundMoney(calculatePaymentSplitTotal(splits))
      : roundMoney(Number(data.cost) || 0);

    const doc: Record<string, unknown> = {
      receiptNumber,
      checkInAt,
      createdAt: Timestamp.now(),
      checkInType: 'room' as const,
      roomId: data.room_id,
      cost: totalCollected,
      staffName: data.staff_name,
      carPlate: data.car_plate,
      carMake: data.car_make,
      carColor: data.car_color,
      note: data.note ?? '',
    };

    if (submissionKey) {
      doc.roomSubmissionKey = submissionKey;
    }

    if (data.employee_id) doc.employeeId = data.employee_id;
    if (data.created_by_username) doc.createdByUsername = data.created_by_username;
    if (data.employee_name_snapshot) doc.employeeNameSnapshot = data.employee_name_snapshot;
    if (data.created_by_role) doc.createdByRole = data.created_by_role;

    if (hasSplits) {
      doc.paymentSplits = splits as RoomPaymentSplit[];
      doc.totalCollected = totalCollected;
      doc.paymentMethod = splits![0].method;
    } else {
      doc.paymentMethod = data.payment_method;
    }

    doc.isCheckedOut = false;

    const newRef = checkinsRef.doc();
    tx.set(newRef, doc);

    const nextReceiptNumber = receiptNum + 1;
    tx.set(settingsRef, { nextReceiptNumber }, { merge: true });

    if (idempotencyRef) {
      tx.set(idempotencyRef, {
        checkinId: newRef.id,
        receiptNumber,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return { id: newRef.id, receiptNumber, duplicate: false as const };
  });

  if (!result.duplicate) {
    await refreshSummariesForDates(data.date);
  }
  return result.receiptNumber;
}

async function refreshSummariesForDates(...dates: Array<string | null | undefined>): Promise<void> {
  const { refreshBusinessDaySummaries } = await import('@/lib/server/refreshBusinessDaySummaries');
  await refreshBusinessDaySummaries(...dates);
}

export interface CreatePastRoomCheckinInput {
  room_id: number | string;
  check_in_date: string;
  check_in_time: string;
  staff_name: string;
  receipt_number: string;
  payment_splits: RoomPaymentSplit[];
  note?: string;
  /** Optional; omit or undefined → analytics treat as 1. */
  receipts_captured?: number;
  adminUsername: string;
  adminUserId?: string;
}

/**
 * Admin-only historical room stay. Does not bump `settings/receipts` counter.
 * Stored as a normal room doc with `isPastEntry` + closed flags so occupancy/checkout flows ignore it.
 */
export async function createPastRoomCheckin(data: CreatePastRoomCheckinInput): Promise<string> {
  const db = getAdminDb();
  const receiptNumber = formatReceiptNumber(data.receipt_number);
  const dt = DateTime.fromFormat(
    `${data.check_in_date} ${data.check_in_time}`,
    'yyyy-MM-dd HH:mm',
    { zone: 'America/Puerto_Rico' }
  );
  const checkInAt = dt.isValid ? Timestamp.fromDate(dt.toJSDate()) : Timestamp.now();
  const splits = data.payment_splits;
  const totalCollected = roundMoney(calculatePaymentSplitTotal(splits));
  /** When the admin entered this record — not the historical stay date/time. */
  const createdAt = Timestamp.now();
  const noteTrim = (data.note ?? '').trim().slice(0, 500);

  const doc: Record<string, unknown> = {
    receiptNumber,
    checkInAt,
    createdAt,
    checkInType: 'room' as const,
    roomId: data.room_id,
    cost: totalCollected,
    staffName: data.staff_name,
    employeeNameSnapshot: data.staff_name,
    carPlate: '',
    carMake: '',
    carColor: 'other',
    note: noteTrim,
    paymentSplits: splits,
    totalCollected: totalCollected,
    paymentMethod: splits[0]?.method,
    isCheckedOut: true,
    isPastEntry: true,
    source: 'admin_past_room_checkin',
    requiresCheckout: false,
    requiresCleaning: false,
    checkoutStatus: 'not_required',
    cleaningStatus: 'not_required',
    createdByRole: 'admin',
    createdByUsername: data.adminUsername,
  };
  if (data.adminUserId?.trim()) {
    doc.createdByUid = data.adminUserId.trim();
  }
  if (data.receipts_captured != null) {
    doc.receiptsCaptured = data.receipts_captured;
  }

  const ref = await db.collection(CHECKINS_COLLECTION).add(doc);
  await refreshSummariesForDates(data.check_in_date);
  return ref.id;
}

export interface CreateSimpleCheckinInput {
  date: string;
  time: string;
  staff_name: string;
  lineItems: LineItem[];
  summarizedItems: SummarizedItem[];
  notes?: string;
  payment_method: string;
  payment_splits?: RoomPaymentSplit[];
  employee_id?: string;
  created_by_username?: string;
  employee_name_snapshot?: string;
  created_by_role?: 'admin' | 'employee';
}

/** Create a food or beer check-in (same collection, checkInType set, lineItems + summarizedItems + notes). */
export async function createSimpleCheckin(
  checkInType: 'food' | 'beer',
  data: CreateSimpleCheckinInput
): Promise<void> {
  const db = getAdminDb();
  const checkinsRef = db.collection(CHECKINS_COLLECTION);

  const dt = DateTime.fromFormat(
    `${data.date} ${data.time}`,
    'yyyy-MM-dd HH:mm',
    { zone: 'America/Puerto_Rico' }
  );
  const checkInAt = dt.isValid ? Timestamp.fromDate(dt.toJSDate()) : Timestamp.now();

  const splits = data.payment_splits?.length ? data.payment_splits : undefined;
  const paymentMethod = splits?.[0]?.method
    ? normalizePaymentMethod(splits[0].method)
    : normalizePaymentMethod(data.payment_method);

  const doc: Record<string, unknown> = {
    checkInAt,
    createdAt: Timestamp.now(),
    checkInType,
    staffName: data.staff_name,
    lineItems: data.lineItems,
    summarizedItems: data.summarizedItems,
    note: data.notes ?? '',
    paymentMethod,
  };
  if (splits?.length) {
    doc.paymentSplits = splits;
    doc.totalCollected = calculatePaymentSplitTotal(splits);
  }

  if (data.employee_id) doc.employeeId = data.employee_id;
  if (data.created_by_username) doc.createdByUsername = data.created_by_username;
  if (data.employee_name_snapshot) doc.employeeNameSnapshot = data.employee_name_snapshot;
  if (data.created_by_role) doc.createdByRole = data.created_by_role;

  await checkinsRef.add(doc);
  await refreshSummariesForDates(data.date);
}

export interface CreatePastFoodBeverageCheckinInput {
  date: string;
  time: string;
  staff_name: string;
  lineItems: LineItem[];
  payment_method: string;
  payment_splits: RoomPaymentSplit[];
  notes?: string;
  /** Optional; omit or undefined → analytics treat as 1. */
  receipts_captured?: number;
  adminUsername: string;
  adminUserId?: string;
}

export type CreatePastBeerCheckinInput = CreatePastFoodBeverageCheckinInput;

/**
 * Admin-only historical food or beer sale. Same shape as `createSimpleCheckin` for that type,
 * plus `isPastEntry`, `source`, and `paymentMethod`. No receipt number field.
 */
async function createPastFoodOrBeerCheckin(
  checkInType: 'food' | 'beer',
  data: CreatePastFoodBeverageCheckinInput
): Promise<string> {
  const db = getAdminDb();
  const checkinsRef = db.collection(CHECKINS_COLLECTION);

  const timeHm = String(data.time).trim().slice(0, 5);
  const dt = DateTime.fromFormat(
    `${data.date} ${timeHm}`,
    'yyyy-MM-dd HH:mm',
    { zone: 'America/Puerto_Rico' }
  );
  const checkInAt = dt.isValid ? Timestamp.fromDate(dt.toJSDate()) : Timestamp.now();

  const lineItems = data.lineItems;
  const summarizedItems = summarizeLineItems(lineItems);

  const noteTrim = (data.notes ?? '').trim().slice(0, 250);
  const splits = data.payment_splits;
  const splitTotal = calculatePaymentSplitTotal(splits);
  const paymentMethod = splits[0]?.method
    ? normalizePaymentMethod(splits[0].method)
    : normalizePaymentMethod(data.payment_method);

  const doc: Record<string, unknown> = {
    checkInAt,
    createdAt: Timestamp.now(),
    checkInType,
    staffName: data.staff_name,
    employeeNameSnapshot: data.staff_name,
    lineItems,
    summarizedItems,
    note: noteTrim,
    paymentMethod,
    paymentSplits: splits,
    totalCollected: splitTotal,
    isPastEntry: true,
    source: 'admin_past_entry',
    createdByRole: 'admin',
    createdByUsername: data.adminUsername,
  };
  if (data.adminUserId?.trim()) {
    doc.createdByUid = data.adminUserId.trim();
  }
  if (data.receipts_captured != null) {
    doc.receiptsCaptured = data.receipts_captured;
  }

  const ref = await checkinsRef.add(doc);
  await refreshSummariesForDates(data.date);
  return ref.id;
}
export async function createPastFoodBeverageCheckin(data: CreatePastFoodBeverageCheckinInput): Promise<string> {
  return createPastFoodOrBeerCheckin('food', data);
}

/**
 * Admin-only historical beer sale.
 */
export async function createPastBeerCheckin(data: CreatePastBeerCheckinInput): Promise<string> {
  return createPastFoodOrBeerCheckin('beer', data);
}

/**
 * Single source of truth for next receipt: settings/receipts.nextReceiptNumber.
 * Falls back to counters/receipt if settings doc does not exist (migration).
 * If Firestore/Google auth is unavailable, returns "00001" so the app can run.
 */
export async function getNextReceiptNumber(): Promise<string> {
  try {
    const db = getAdminDb();
    const settingsRef = db.collection(SETTINGS_COLLECTION).doc(RECEIPTS_DOC_ID);
    const settingsSnap = await settingsRef.get();
    if (settingsSnap.exists) {
      const nextNum = (settingsSnap.data()?.nextReceiptNumber as number) ?? 0;
      return formatReceiptNumber(nextNum);
    }
    const counterRef = db.collection(COUNTERS_COLLECTION).doc(RECEIPT_COUNTER_ID);
    const counterSnap = await counterRef.get();
    const nextNum = counterSnap.exists
      ? (counterSnap.data()?.nextReceiptNumber as number) ?? 1
      : 1;
    return formatReceiptNumber(nextNum);
  } catch (err) {
    if (isFirestoreUnavailableError(err)) {
      console.warn('Firestore unavailable (getNextReceiptNumber), using default 00001:', (err as Error).message);
      return '00001';
    }
    throw err;
  }
}

function startOfDayISO(isoDate: string): Date {
  const dt = DateTime.fromISO(isoDate, { zone: 'America/Puerto_Rico' }).startOf('day');
  return dt.toJSDate();
}

function endExclusiveISO(isoDate: string): Date {
  const dt = DateTime.fromISO(isoDate, { zone: 'America/Puerto_Rico' })
    .plus({ days: 1 })
    .startOf('day');
  return dt.toJSDate();
}

const UNFILTERED_LIMIT = 3000;

/** Cap for Admin View Check-Ins with no date selected (newest-created page). */
export const VIEW_CHECKINS_RECENT_LIMIT = 100;

/**
 * Bounded check-in query: `checkInAt` in half-open [start, end).
 * Used by Shift Summary Cron (per-shift window) and day-range helpers.
 */
export async function listCheckinsByInstantRange(start: Date, end: Date): Promise<CheckIn[]> {
  const started = Date.now();
  try {
    const db = getAdminDb();
    const snapshot = await db
      .collection(CHECKINS_COLLECTION)
      .where('checkInAt', '>=', Timestamp.fromDate(start))
      .where('checkInAt', '<', Timestamp.fromDate(end))
      .orderBy('checkInAt', 'desc')
      .get();
    const result = snapshot.docs.map((doc) => normalizeCheckin(doc.id, doc.data()));
    logInfo('checkins.listByInstantRange.complete', {
      docsReturned: result.length,
      start: start.toISOString(),
      end: end.toISOString(),
      durationMs: Date.now() - started,
    });
    return result;
  } catch (err) {
    if (isFirestoreUnavailableError(err)) {
      if (isProduction()) throw err;
      console.warn(
        'Firestore unavailable (listCheckinsByInstantRange), returning empty list:',
        (err as Error).message
      );
      return [];
    }
    throw err;
  }
}

/**
 * List check-ins in a date range. Dates are YYYY-MM-DD and interpreted in America/Puerto_Rico.
 * - Filtered (startISO and endISO provided): filter by business date (checkInAt), order by checkInAt desc.
 * - Unfiltered (both omitted): return recent records ordered by creation/submission time desc (createdAt, with fallback to checkInAt for legacy docs).
 * If Firestore/Google auth is unavailable, returns [] so the app can run.
 *
 * View Check-Ins unfiltered mode should use {@link listRecentCheckinsByCreatedAt} instead so a
 * historical past entry created today is not missed by a checkInAt-window cap.
 */
export async function listCheckinsByDateRange(
  startISO?: string,
  endISO?: string
): Promise<CheckIn[]> {
  const started = Date.now();
  try {
    const filteredMode = startISO != null && startISO !== '' && endISO != null && endISO !== '';

    if (filteredMode) {
      const result = await listCheckinsByInstantRange(
        startOfDayISO(startISO!),
        endExclusiveISO(endISO!)
      );
      logInfo('checkins.list.complete', {
        docsReturned: result.length,
        startISO: startISO ?? null,
        endISO: endISO ?? null,
        filteredMode: true,
        durationMs: Date.now() - started,
      });
      return result;
    }

    const db = getAdminDb();
    const now = DateTime.now().setZone('America/Puerto_Rico');
    const start = Timestamp.fromDate(new Date(0));
    const endExclusive = Timestamp.fromDate(now.plus({ years: 1 }).toJSDate());

    const snapshot = await db
      .collection(CHECKINS_COLLECTION)
      .where('checkInAt', '>=', start)
      .where('checkInAt', '<', endExclusive)
      .orderBy('checkInAt', 'desc')
      .limit(UNFILTERED_LIMIT)
      .get();

    const sorted = [...snapshot.docs].sort((a, b) =>
      compareCheckinsByCreatedAtDesc(a.data(), b.data())
    );
    const result = sorted.map((doc) => normalizeCheckin(doc.id, doc.data()));
    logInfo('checkins.list.complete', {
      docsReturned: result.length,
      startISO: null,
      endISO: null,
      filteredMode: false,
      durationMs: Date.now() - started,
    });
    return result;
  } catch (err) {
    if (isFirestoreUnavailableError(err)) {
      if (isProduction()) throw err;
      console.warn('Firestore unavailable (listCheckinsByDateRange), returning empty list:', (err as Error).message);
      return [];
    }
    throw err;
  }
}

/**
 * Newest-entered check-ins across all business dates (room, food, beer).
 * Ordered by createdAt desc so a past entry dated weeks ago still ranks at the top if it was just saved.
 * Capped — does not load the full historical collection.
 */
export async function listRecentCheckinsByCreatedAt(
  limit = VIEW_CHECKINS_RECENT_LIMIT
): Promise<CheckIn[]> {
  const started = Date.now();
  const cappedLimit = Math.min(Math.max(1, limit), VIEW_CHECKINS_RECENT_LIMIT);
  try {
    const db = getAdminDb();
    const snapshot = await db
      .collection(CHECKINS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(cappedLimit)
      .get();

    const sorted = [...snapshot.docs].sort((a, b) =>
      compareCheckinsByCreatedAtDesc(a.data(), b.data())
    );
    const result = sorted.map((doc) => normalizeCheckin(doc.id, doc.data()));
    logInfo('checkins.recent-by-created.complete', {
      docsReturned: result.length,
      limit: cappedLimit,
      durationMs: Date.now() - started,
    });
    return result;
  } catch (err) {
    if (isFirestoreUnavailableError(err)) {
      if (isProduction()) throw err;
      console.warn(
        'Firestore unavailable (listRecentCheckinsByCreatedAt), returning empty list:',
        (err as Error).message
      );
      return [];
    }
    throw err;
  }
}

export async function deleteCheckinById(id: string): Promise<void> {
  const db = getAdminDb();
  const ref = db.collection(CHECKINS_COLLECTION).doc(id);
  const snap = await ref.get();
  const businessDate = snap.exists
    ? normalizeCheckin(id, snap.data() as Record<string, unknown>).date
    : undefined;
  await ref.delete();
  await refreshSummariesForDates(businessDate);
}

/**
 * Room stays awaiting checkout: checkInType room and isCheckedOut === false. Sorted by room number.
 * Legacy room docs without isCheckedOut are excluded (not considered active stays).
 *
 * Defensive: if multiple active docs exist for the same room (historical double-writes), only the
 * canonical stay (newest by max(createdAt, checkInAt)) is returned so checkout tiles stay unique.
 */
export async function listActiveOccupiedRoomCheckins(): Promise<CheckIn[]> {
  const started = Date.now();
  try {
    const db = getAdminDb();
    const snapshot = await db
      .collection(CHECKINS_COLLECTION)
      .where('checkInType', '==', 'room')
      .where('isCheckedOut', '==', false)
      .get();
    const activeDocs = snapshot.docs.filter((doc) => isActiveOccupiedRoomDoc(doc.data()));
    const canonicalDocs = dedupeActiveRoomStaySnapshots(activeDocs);
    const list = canonicalDocs.map((doc) => normalizeCheckin(doc.id, doc.data()));
    const sorted = sortRoomsForDisplay(list);
    logInfo('checkins.active-occupied.complete', {
      docsReturned: snapshot.size,
      activeDocs: activeDocs.length,
      canonicalReturned: sorted.length,
      durationMs: Date.now() - started,
    });
    return sorted;
  } catch (err) {
    if (isFirestoreUnavailableError(err)) {
      if (isProduction()) throw err;
      console.warn('Firestore unavailable (listActiveOccupiedRoomCheckins):', (err as Error).message);
      return [];
    }
    throw err;
  }
}

export interface CheckoutRoomInput {
  cleanedBy: string;
  /** Session user performing the action (stored on checkedOutBy / audit). */
  performedBy: string;
}

export async function checkoutRoomCheckin(id: string, payload: CheckoutRoomInput): Promise<void> {
  const db = getAdminDb();
  const ref = db.collection(CHECKINS_COLLECTION).doc(id);
  const editsRef = ref.collection(EDITS_SUBCOLLECTION);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error('Check-in not found');
  }
  const data = snapshot.data()!;
  if ((data.checkInType as string | undefined) !== 'room') {
    throw new Error('Check-in is not a room record');
  }
  if (data.isCheckedOut === true) {
    throw new Error('Room already checked out');
  }
  if (data.isPastEntry === true) {
    throw new Error('Past entries do not require checkout');
  }

  const now = Timestamp.now();
  const before = {
    roomCheckout: 'Active stay' as const,
  };
  const after = {
    roomCheckout: `Checked out and cleaned by ${payload.cleanedBy}`,
    checkedOutAt: now,
    cleanedAt: now,
  };

  await ref.update({
    isCheckedOut: true,
    checkedOutAt: now,
    cleanedAt: now,
    checkedOutBy: payload.performedBy,
    cleanedBy: payload.cleanedBy,
    updatedAt: now,
    updatedBy: payload.performedBy,
  });

  try {
    await editsRef.add({
      before,
      after,
      editedAt: now,
      editedBy: payload.performedBy,
      changedFields: ['roomCheckout'],
    });
  } catch (auditErr) {
    console.error('checkinsRepo.checkoutRoomCheckin: audit write failed', auditErr);
  }
}

const EDITS_SUBCOLLECTION = 'edits';

const ZONE = 'America/Puerto_Rico';

/** Normalize persisted classification (Firestore: checkInType; legacy docs → room). */
function normalizeFirestoreCheckInKind(data: Record<string, unknown>): CheckInType {
  const raw = data.checkInType as string | undefined;
  if (raw === 'food') return 'food';
  if (raw === 'beer') return 'beer';
  return 'room';
}

function timestampFromPuertoRicoWallDateTime(dateStr: string, timeHm: string): Timestamp | undefined {
  const datePart = String(dateStr ?? '').trim();
  const hm = String(timeHm ?? '').trim().slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return undefined;
  if (!/^\d{2}:\d{2}$/.test(hm)) return undefined;
  const dt = DateTime.fromFormat(`${datePart} ${hm}`, 'yyyy-MM-dd HH:mm', { zone: ZONE });
  if (!dt.isValid) return undefined;
  return Timestamp.fromDate(dt.toJSDate());
}

function normalizeStoredDocNote(noteRaw: unknown): string {
  if (noteRaw == null) return '';
  return String(noteRaw).trim();
}

/**
 * Admin PATCH: merge staff allowlist validation, wall-time `checkInAt`, and notes. Check-in type is fixed from the document.
 */
export async function adminApplyCheckinPatch(
  id: string,
  body: Record<string, unknown>,
  editedBy: string,
  staffAllowlist?: readonly string[]
): Promise<void> {
  const snapshot = await getAdminDb().collection(CHECKINS_COLLECTION).doc(id).get();
  if (!snapshot.exists) throw new Error('Check-in not found');
  const data = snapshot.data()!;

  const staffOpts =
    staffAllowlist && staffAllowlist.length > 0 ? ({ staffAllowlist } as const) : undefined;

  const checkInDate = typeof body.check_in_date === 'string' ? body.check_in_date.trim() : '';
  const checkInTime = typeof body.check_in_time === 'string' ? body.check_in_time.trim() : '';
  if (!checkInDate || !checkInTime) {
    throw new Error('Invalid check-in date or time');
  }
  if (!timestampFromPuertoRicoWallDateTime(checkInDate, checkInTime)) {
    throw new Error('Invalid check-in date or time');
  }

  const docKind = normalizeFirestoreCheckInKind(data);
  const previousBusinessDate = normalizeCheckin(id, data).date;
  const reqTypeRaw = body.checkInType;
  if (reqTypeRaw === 'room' || reqTypeRaw === 'food' || reqTypeRaw === 'beer') {
    if (reqTypeRaw !== docKind) {
      throw new Error('Check-in type cannot be changed');
    }
  }

  if (docKind === 'room') {
    const rawRoom = {
      receipt_number: body.receipt_number,
      staff_name: body.staff_name,
      room_id: body.room_id,
      payment_splits: body.payment_splits,
    };
    const validation = validateUpdateCheckin(rawRoom as Record<string, unknown>, true, {
      ...staffOpts,
      allowLateEntryPlaceholderRoom: data.isPastEntry === true,
    });
    if (!validation.valid || !validation.payment_splits) {
      throw new Error(Object.values(validation.errors).find(Boolean) ?? 'Validation failed');
    }
    const padded = normalizeReceipt(String(rawRoom.receipt_number ?? ''));
    if (padded === null) throw new Error('Invalid receipt number');

    let receiptsCapturedPatch: number | null | undefined;
    if (data.isPastEntry === true && 'receipts_captured' in body) {
      const parsed = parseReceiptsCapturedInput(body.receipts_captured);
      if (!parsed.ok) throw new Error('Invalid receipts captured value');
      receiptsCapturedPatch = parsed.value ?? null;
    }

    await updateCheckin(
      id,
      {
        receipt_number: padded,
        staff_name: String(rawRoom.staff_name).trim(),
        room_id: validation.room_id ?? (rawRoom.room_id as number | string),
        payment_splits: validation.payment_splits,
        check_in_date: checkInDate,
        check_in_time: checkInTime,
        note: typeof body.note === 'string' ? String(body.note).trim() : undefined,
        ...(receiptsCapturedPatch !== undefined
          ? { receipts_captured: receiptsCapturedPatch }
          : {}),
      },
      editedBy
    );
    await refreshSummariesForDates(previousBusinessDate, checkInDate);
    return;
  }

  const baseCatalog =
    docKind === 'beer'
      ? data.isPastEntry === true
        ? ADMIN_LATE_BEER_ITEMS
        : BEER_ITEMS
      : data.isPastEntry === true
        ? ADMIN_LATE_FOOD_ITEMS
        : FOOD_ITEMS;
  const storedItemsSource = Array.isArray(data.lineItems)
    ? (data.lineItems as Array<Record<string, unknown>>)
    : Array.isArray(data.summarizedItems)
      ? (data.summarizedItems as Array<Record<string, unknown>>)
      : [];
  const catalog = extendCatalogWithStoredItems(baseCatalog, storedItemsSource);
  const rawFb: Record<string, unknown> = {
    staff_name: body.staff_name,
    payment_method: body.payment_method,
    payment_splits: body.payment_splits,
    lineItems: body.lineItems,
    itemId: body.itemId,
    itemLabel: body.itemLabel,
    quantity: body.quantity,
    amountCollected: body.amountCollected,
  };
  const validation = validateUpdateFoodBeerCheckin(rawFb, { ...staffOpts, catalog });
  if (!validation.valid || !validation.normalizedLineItems?.length) {
    const err =
      Object.values(validation.errors).find((m) => typeof m === 'string' && m.trim()) ??
      'Validation failed';
    throw new Error(err);
  }
  const paymentMethod =
    validation.payment_splits?.[0]?.method ?? String(rawFb.payment_method ?? '').trim();

  let receiptsCapturedPatch: number | null | undefined;
  if (data.isPastEntry === true && 'receipts_captured' in body) {
    const parsed = parseReceiptsCapturedInput(body.receipts_captured);
    if (!parsed.ok) throw new Error('Invalid receipts captured value');
    receiptsCapturedPatch = parsed.value ?? null;
  }

  await updateCheckinFoodBeer(
    id,
    {
      staff_name: String(rawFb.staff_name).trim(),
      lineItems: validation.normalizedLineItems,
      payment_method: paymentMethod,
      ...(validation.payment_splits ? { payment_splits: validation.payment_splits } : {}),
      check_in_date: checkInDate,
      check_in_time: checkInTime,
      ...(typeof body.note === 'string' ? { note: String(body.note).trim() } : {}),
      ...(receiptsCapturedPatch !== undefined
        ? { receipts_captured: receiptsCapturedPatch }
        : {}),
    },
    editedBy
  );
  await refreshSummariesForDates(previousBusinessDate, checkInDate);
}

export interface UpdateCheckinInput {
  receipt_number: string;
  staff_name: string;
  room_id?: number | string;
  payment_splits: RoomPaymentSplit[];
  /** When valid, updates Firestore checkInAt in America/Puerto_Rico wall time. */
  check_in_date?: string;
  check_in_time?: string;
  /** When defined — including `''` — persists trimmed note. Omit for legacy callers (no note change). */
  note?: string;
  /**
   * Past entry only. `number` sets receiptsCaptured; `null` clears the field (count defaults to 1).
   * Omit to leave unchanged.
   */
  receipts_captured?: number | null;
}

/**
 * Update editable fields on a room check-in doc. Applies checkInAt from wall date/time when provided.
 * Writes audit snapshot to checkins/{id}/edits. Editing receipt does not affect next receipt counter.
 */
export async function updateCheckin(
  id: string,
  payload: UpdateCheckinInput,
  editedBy: string
): Promise<void> {
  const db = getAdminDb();
  const ref = db.collection(CHECKINS_COLLECTION).doc(id);
  const editsRef = ref.collection(EDITS_SUBCOLLECTION);

  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error('Check-in not found');
  }
  const data = snapshot.data()!;
  if (normalizeFirestoreCheckInKind(data) !== 'room') {
    throw new Error('Check-in is not a room record');
  }

  const isPastEntry = data.isPastEntry === true;

  let newCheckInAt: Timestamp | undefined;
  if (typeof payload.check_in_date === 'string' && payload.check_in_date.trim()) {
    if (typeof payload.check_in_time !== 'string' || !payload.check_in_time.trim()) {
      throw new Error('Check-in date and time are required together');
    }
    newCheckInAt = timestampFromPuertoRicoWallDateTime(
      payload.check_in_date.trim(),
      payload.check_in_time.trim()
    );
    if (!newCheckInAt) throw new Error('Invalid check-in date or time');
  }

  const receiptNumber = formatReceiptNumber(payload.receipt_number);
  const splits = payload.payment_splits;
  const totalAfter = roundMoney(calculatePaymentSplitTotal(splits));
  const breakdownAfter = formatPaymentBreakdownComma(splits);

  const beforeTs = data.checkInAt as Timestamp | undefined;
  const beforeCheckInIso =
    beforeTs && typeof beforeTs.toDate === 'function'
      ? DateTime.fromJSDate(beforeTs.toDate(), { zone: ZONE }).toISO() ?? ''
      : '';

  const noteBefore = normalizeStoredDocNote(data.note ?? data.notes);
  const noteAfter =
    payload.note !== undefined ? String(payload.note).trim() : noteBefore;

  const receiptsBefore =
    typeof data.receiptsCaptured === 'number' && Number.isInteger(data.receiptsCaptured)
      ? data.receiptsCaptured
      : null;
  const receiptsAfterSpecified = payload.receipts_captured !== undefined;
  const receiptsAfter = receiptsAfterSpecified
    ? payload.receipts_captured
    : receiptsBefore;

  const before: Record<string, unknown> = {
    receiptNumber: data.receiptNumber ?? '',
    staffName: data.staffName ?? '',
    roomId: data.roomId != null && data.roomId !== '' ? data.roomId : 0,
    paymentBreakdown: formatPaymentBreakdownForAuditDoc(data),
    totalCollected: getRoomCollectedTotalFromDoc(data),
    checkInAt: beforeCheckInIso,
    note: noteBefore,
    receiptsCaptured: receiptsBefore,
  };
  let afterCheckInIso = beforeCheckInIso;
  if (newCheckInAt && typeof newCheckInAt.toDate === 'function') {
    afterCheckInIso =
      DateTime.fromJSDate(newCheckInAt.toDate(), { zone: ZONE }).toISO() ?? beforeCheckInIso;
  }
  const after: Record<string, unknown> = {
    receiptNumber,
    staffName: payload.staff_name,
    roomId: payload.room_id ?? 0,
    paymentBreakdown: breakdownAfter,
    totalCollected: totalAfter,
    checkInAt: afterCheckInIso,
    note: noteAfter,
    receiptsCaptured: receiptsAfter,
  };

  const changedFields: string[] = [];
  if (String(before.receiptNumber) !== String(after.receiptNumber)) changedFields.push('receiptNumber');
  if (String(before.staffName) !== String(after.staffName)) changedFields.push('staffName');
  if (String(before.roomId) !== String(after.roomId)) changedFields.push('roomId');
  if (String(before.paymentBreakdown) !== String(after.paymentBreakdown)) {
    changedFields.push('paymentBreakdown');
  }
  if (Number(before.totalCollected) !== Number(after.totalCollected)) {
    changedFields.push('totalCollected');
  }
  if (newCheckInAt && typeof beforeTs?.toMillis === 'function') {
    if (beforeTs.toMillis() !== newCheckInAt.toMillis()) {
      changedFields.push('checkInAt');
    }
  }
  if (String(before.note) !== String(after.note)) {
    changedFields.push('note');
  }
  if (receiptsAfterSpecified && receiptsBefore !== receiptsAfter) {
    changedFields.push('receiptsCaptured');
  }

  if (changedFields.length === 0) {
    return;
  }

  const updateData: Record<string, unknown> = {
    receiptNumber,
    staffName: payload.staff_name,
    roomId: payload.room_id ?? 0,
    cost: totalAfter,
    totalCollected: totalAfter,
    paymentSplits: splits,
    paymentMethod: splits[0]?.method,
    note: noteAfter,
    updatedAt: Timestamp.now(),
    updatedBy: editedBy,
  };
  if (changedFields.includes('checkInAt') && newCheckInAt) {
    updateData.checkInAt = newCheckInAt;
  }
  if (isPastEntry && changedFields.includes('staffName')) {
    updateData.employeeNameSnapshot = payload.staff_name;
  }
  if (isPastEntry && receiptsAfterSpecified) {
    updateData.receiptsCaptured =
      receiptsAfter == null ? FieldValue.delete() : receiptsAfter;
  }

  await ref.update(updateData);
  try {
    await editsRef.add({
      before,
      after,
      editedAt: Timestamp.now(),
      editedBy,
      changedFields,
    });
  } catch (auditErr) {
    console.error('checkinsRepo.updateCheckin: audit write failed', auditErr);
  }
}

function lineItemsForAuditFromFirestore(data: Record<string, unknown>): LineItem[] {
  const raw = (data.lineItems as LineItem[] | undefined) ?? [];
  if (raw.length > 0) return raw;
  const sums = (data.summarizedItems as SummarizedItem[] | undefined) ?? [];
  return sums.map((s) => ({
    itemId: s.itemId,
    itemLabel: s.itemLabel,
    quantitySold: s.totalQuantitySold,
    amountCollected: s.totalAmountCollected,
  }));
}

function auditLabelForFoodBeerLines(lines: LineItem[]): string {
  return lines.map((r) => `${r.itemLabel} (${r.quantitySold})`).join('; ');
}

function auditQuantityTotal(lines: LineItem[]): number {
  return lines.reduce((sum, r) => sum + (Number(r.quantitySold) || 0), 0);
}

function auditAmountTotal(lines: LineItem[]): number {
  return lines.reduce((sum, r) => sum + (Number(r.amountCollected) || 0), 0);
}

function serializeFoodBeerLinesForAudit(lines: LineItem[]): string {
  return JSON.stringify(
    lines.map((r) => ({
      itemId: r.itemId,
      qty: r.quantitySold,
      amt: r.amountCollected,
    }))
  );
}

export interface UpdateCheckinFoodBeerInput {
  staff_name: string;
  lineItems: LineItem[];
  payment_method: string;
  payment_splits?: RoomPaymentSplit[];
  check_in_date?: string;
  check_in_time?: string;
  /** When defined (including ''); omit to preserve existing note unchanged. */
  note?: string;
  /** Past entry only. `number` sets; `null` clears; omit leaves unchanged. */
  receipts_captured?: number | null;
}

/**
 * Update food/beer check-in. Persists lineItems and summarizedItems (multiple rows supported).
 */
export async function updateCheckinFoodBeer(
  id: string,
  payload: UpdateCheckinFoodBeerInput,
  editedBy: string
): Promise<void> {
  const db = getAdminDb();
  const ref = db.collection(CHECKINS_COLLECTION).doc(id);
  const editsRef = ref.collection(EDITS_SUBCOLLECTION);

  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error('Check-in not found');
  }
  const data = snapshot.data()!;
  const docKind = normalizeFirestoreCheckInKind(data);
  if (docKind !== 'food' && docKind !== 'beer') {
    throw new Error('Check-in is not food or beer');
  }

  let newCheckInAt: Timestamp | undefined;
  if (typeof payload.check_in_date === 'string' && payload.check_in_date.trim()) {
    if (typeof payload.check_in_time !== 'string' || !payload.check_in_time.trim()) {
      throw new Error('Check-in date and time are required together');
    }
    newCheckInAt = timestampFromPuertoRicoWallDateTime(
      payload.check_in_date.trim(),
      payload.check_in_time.trim()
    );
    if (!newCheckInAt) throw new Error('Invalid check-in date or time');
  }

  const lineItems = payload.lineItems;
  const summarizedItems = summarizeLineItems(lineItems);

  const auditBeforeLines = lineItemsForAuditFromFirestore(data);
  const beforeSplits = parsePaymentSplitsFromFirestore(data.paymentSplits);
  const beforePaymentRaw = data.paymentMethod ?? data.payment;
  const beforePaymentStored = beforeSplits?.length
    ? beforeSplits[0].method
    : hasStoredPaymentMethodSingle(beforePaymentRaw != null ? String(beforePaymentRaw) : '')
      ? normalizePaymentMethod(String(beforePaymentRaw).trim())
      : '';
  const afterSplits = payload.payment_splits?.length
    ? payload.payment_splits
    : beforeSplits;
  const afterPmRaw = String(payload.payment_method ?? '').trim();
  const afterPaymentStored = afterSplits?.length
    ? afterSplits[0].method
    : hasStoredPaymentMethodSingle(afterPmRaw)
      ? normalizePaymentMethod(afterPmRaw)
      : beforePaymentStored;
  const beforePaymentAudit = beforeSplits?.length
    ? formatPaymentBreakdownComma(beforeSplits)
    : beforePaymentStored;
  const afterPaymentAudit = afterSplits?.length
    ? formatPaymentBreakdownComma(afterSplits)
    : afterPaymentStored;

  const beforeTs = data.checkInAt as Timestamp | undefined;
  const noteBefore = normalizeStoredDocNote(data.note ?? data.notes);
  const noteAfter =
    payload.note !== undefined ? String(payload.note).trim() : noteBefore;

  const isPastEntry = data.isPastEntry === true;
  const receiptsBefore =
    typeof data.receiptsCaptured === 'number' && Number.isInteger(data.receiptsCaptured)
      ? data.receiptsCaptured
      : null;
  const receiptsAfterSpecified = payload.receipts_captured !== undefined;
  const receiptsAfter = receiptsAfterSpecified
    ? payload.receipts_captured
    : receiptsBefore;

  const beforeCheckInIso =
    beforeTs && typeof beforeTs.toDate === 'function'
      ? DateTime.fromJSDate(beforeTs.toDate(), { zone: ZONE }).toISO() ?? ''
      : '';
  let afterCheckInIso = beforeCheckInIso;
  if (newCheckInAt && typeof newCheckInAt.toDate === 'function') {
    afterCheckInIso =
      DateTime.fromJSDate(newCheckInAt.toDate(), { zone: ZONE }).toISO() ?? beforeCheckInIso;
  }

  const before: Record<string, unknown> = {
    checkInAt: beforeCheckInIso,
    note: noteBefore,
    staffName: data.staffName ?? '',
    item: auditLabelForFoodBeerLines(auditBeforeLines),
    quantity: auditQuantityTotal(auditBeforeLines),
    amountCollected: auditAmountTotal(auditBeforeLines),
    paymentMethod: beforePaymentAudit,
    receiptsCaptured: receiptsBefore,
  };
  const after: Record<string, unknown> = {
    checkInAt: afterCheckInIso,
    note: noteAfter,
    staffName: payload.staff_name,
    item: auditLabelForFoodBeerLines(lineItems),
    quantity: auditQuantityTotal(lineItems),
    amountCollected: auditAmountTotal(lineItems),
    paymentMethod: afterPaymentAudit,
    receiptsCaptured: receiptsAfter,
  };
  const changedFields: string[] = [];
  if (newCheckInAt && typeof beforeTs?.toMillis === 'function') {
    if (beforeTs.toMillis() !== newCheckInAt.toMillis()) {
      changedFields.push('checkInAt');
    }
  }
  if (String(before.note) !== String(after.note)) {
    changedFields.push('note');
  }
  if (String(before.staffName) !== String(after.staffName)) changedFields.push('staffName');
  if (serializeFoodBeerLinesForAudit(auditBeforeLines) !== serializeFoodBeerLinesForAudit(lineItems)) {
    changedFields.push('lineItems');
  }
  if (String(before.item) !== String(after.item)) changedFields.push('item');
  if (Number(before.quantity) !== Number(after.quantity)) changedFields.push('quantity');
  if (Number(before.amountCollected) !== Number(after.amountCollected)) changedFields.push('amountCollected');
  if (String(before.paymentMethod) !== String(after.paymentMethod)) changedFields.push('paymentMethod');
  if (receiptsAfterSpecified && receiptsBefore !== receiptsAfter) {
    changedFields.push('receiptsCaptured');
  }

  if (changedFields.length === 0) {
    return;
  }

  const updateData: Record<string, unknown> = {
    staffName: payload.staff_name,
    lineItems,
    summarizedItems,
    paymentMethod: afterPaymentStored,
    note: noteAfter,
    updatedAt: Timestamp.now(),
    updatedBy: editedBy,
  };
  if (payload.payment_splits?.length) {
    updateData.paymentSplits = payload.payment_splits;
    updateData.totalCollected = calculatePaymentSplitTotal(payload.payment_splits);
  }
  if (changedFields.includes('checkInAt') && newCheckInAt) {
    updateData.checkInAt = newCheckInAt;
  }
  if (isPastEntry && receiptsAfterSpecified) {
    updateData.receiptsCaptured =
      receiptsAfter == null ? FieldValue.delete() : receiptsAfter;
  }

  await ref.update(updateData);
  try {
    await editsRef.add({
      before,
      after,
      editedAt: Timestamp.now(),
      editedBy,
      changedFields,
    });
  } catch (auditErr) {
    console.error('checkinsRepo.updateCheckinFoodBeer: audit write failed', auditErr);
  }
}

import {
  EMPLOYEE_ENTRY_ACCESS_HOURS,
  isWithinEmployeeAccessWindow,
} from '@/lib/checkins/employeeAccess';

export { EMPLOYEE_ENTRY_ACCESS_HOURS };

/** @deprecated Prefer EMPLOYEE_ENTRY_ACCESS_HOURS — same value, kept for existing imports. */
export const EMPLOYEE_RECENT_CHECKINS_HOURS = EMPLOYEE_ENTRY_ACCESS_HOURS;

export function getRecordEventMs(data: Record<string, unknown>): number {
  const ts = data.checkInAt as Timestamp | undefined;
  const cr = data.createdAt as Timestamp | undefined;
  const a = typeof ts?.toMillis === 'function' ? ts.toMillis() : 0;
  const b = typeof cr?.toMillis === 'function' ? cr.toMillis() : 0;
  return Math.max(a, b);
}

export function checkinOwnedByEmployee(
  data: Record<string, unknown>,
  opts: { userId?: string | null; username: string }
): boolean {
  if ((data.createdByRole as string) !== 'employee') return false;
  const un = opts.username.trim().toLowerCase();
  const cu =
    typeof data.createdByUsername === 'string' ? data.createdByUsername.trim().toLowerCase() : '';
  const empId = typeof data.employeeId === 'string' ? data.employeeId.trim() : '';
  const uid = opts.userId?.trim();
  if (uid && uid !== 'guest' && empId === uid) return true;
  if (cu === un) return true;
  return false;
}

export function isWithinEmployeeEditHours(
  data: Record<string, unknown>,
  hours: number = EMPLOYEE_ENTRY_ACCESS_HOURS
): boolean {
  return isWithinEmployeeAccessWindow(getRecordEventMs(data), undefined, hours);
}

/**
 * Employee-created check-ins in the rolling window (newest first).
 * Uses `checkInAt >= cutoff` query then filters ownership and event time in memory.
 */
export async function listRecentCheckinsForEmployee(opts: {
  userId?: string | null;
  username: string;
  hours?: number;
}): Promise<CheckIn[]> {
  const hours = opts.hours ?? EMPLOYEE_ENTRY_ACCESS_HOURS;
  const zone = 'America/Puerto_Rico';
  const cutoff = DateTime.now().setZone(zone).minus({ hours });
  const cutoffTs = Timestamp.fromDate(cutoff.toJSDate());
  const cutoffMs = cutoff.toMillis();

  try {
    const db = getAdminDb();
    const snapshot = await db
      .collection(CHECKINS_COLLECTION)
      .where('checkInAt', '>=', cutoffTs)
      .orderBy('checkInAt', 'desc')
      .limit(400)
      .get();

    const out: CheckIn[] = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!checkinOwnedByEmployee(data, { userId: opts.userId, username: opts.username }))
        continue;
      if (getRecordEventMs(data) < cutoffMs) continue;
      out.push(normalizeCheckin(doc.id, data));
    }
    return out;
  } catch (err) {
    if (isFirestoreUnavailableError(err)) {
      if (isProduction()) throw err;
      console.warn('Firestore unavailable (listRecentCheckinsForEmployee):', (err as Error).message);
      return [];
    }
    throw err;
  }
}

export interface EmployeeRoomOperationalPayload {
  payment_splits: RoomPaymentSplit[];
  /** Firestore `roomId` (same semantics as check-in form / admin edit). */
  room_id: number | string;
  car_plate: string;
  car_make: string;
  car_color: string;
  note?: string;
}

/**
 * Employee-only room edits: payment breakdown, room number, vehicle fields, notes.
 * Receipt / staff / check-in time unchanged.
 */
export async function employeeUpdateRoomOperational(
  id: string,
  payload: EmployeeRoomOperationalPayload,
  editedBy: string
): Promise<void> {
  const db = getAdminDb();
  const ref = db.collection(CHECKINS_COLLECTION).doc(id);
  const editsRef = ref.collection(EDITS_SUBCOLLECTION);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error('Check-in not found');
  }
  const data = snapshot.data()!;
  if (((data.checkInType as string) ?? 'room') !== 'room') {
    throw new Error('Check-in is not a room record');
  }
  if (data.isPastEntry === true) {
    throw new Error('Past entries cannot be edited by employees');
  }

  const splits = payload.payment_splits;
  const totalAfter = roundMoney(calculatePaymentSplitTotal(splits));

  const noteTrim = (payload.note ?? '').trim().slice(0, 500);
  const carPlate = payload.car_plate.trim().toUpperCase().slice(0, 10);
  const carMake = payload.car_make.trim().toUpperCase().slice(0, 30);
  const carColor = payload.car_color.trim();
  const roomIdBefore =
    data.roomId != null && data.roomId !== '' ? (data.roomId as number | string) : 0;
  const roomLifecycleLocked = isEmployeeRoomNumberLockedForCompletedStayDoc(data);
  const roomIdAfter = roomLifecycleLocked ? roomIdBefore : payload.room_id;

  if (!roomLifecycleLocked) {
    const activeStays = await listActiveOccupiedRoomCheckins();
    if (!isTargetRoomAvailableForEmployeeCorrection(activeStays, id, roomIdAfter, roomIdBefore)) {
      throw new HttpError(400, 'error_employee_room_occupied');
    }
  }

  const before: Record<string, unknown> = {
    roomId: roomIdBefore,
    paymentBreakdown: formatPaymentBreakdownForAuditDoc(data),
    totalCollected: getRoomCollectedTotalFromDoc(data),
    carPlate: data.carPlate ?? '',
    carMake: data.carMake ?? '',
    carColor: data.carColor ?? '',
    note: data.note ?? '',
  };
  const after: Record<string, unknown> = {
    roomId: roomIdAfter,
    paymentBreakdown: formatPaymentBreakdownComma(splits),
    totalCollected: totalAfter,
    carPlate,
    carMake,
    carColor,
    note: noteTrim,
  };

  const changedFields: string[] = [];
  if (String(before.roomId) !== String(after.roomId)) changedFields.push('roomId');
  if (String(before.paymentBreakdown) !== String(after.paymentBreakdown))
    changedFields.push('paymentBreakdown');
  if (Number(before.totalCollected) !== Number(after.totalCollected)) changedFields.push('totalCollected');
  if (String(before.carPlate) !== String(after.carPlate)) changedFields.push('carPlate');
  if (String(before.carMake) !== String(after.carMake)) changedFields.push('carMake');
  if (String(before.carColor) !== String(after.carColor)) changedFields.push('carColor');
  if (String(before.note) !== String(after.note)) changedFields.push('note');

  if (changedFields.length === 0) {
    return;
  }

  const updateData: Record<string, unknown> = {
    roomId: roomIdAfter,
    cost: totalAfter,
    totalCollected: totalAfter,
    paymentSplits: splits,
    paymentMethod: splits[0]?.method,
    carPlate,
    carMake,
    carColor,
    note: noteTrim,
    updatedAt: Timestamp.now(),
    updatedBy: editedBy,
  };

  await ref.update(updateData);
  try {
    await editsRef.add({
      before,
      after,
      editedAt: Timestamp.now(),
      editedBy,
      changedFields,
    });
  } catch (auditErr) {
    console.error('checkinsRepo.employeeUpdateRoomOperational: audit write failed', auditErr);
  }
}

export interface CheckinEditRecord {
  id: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  editedAt: string;
  editedBy: string;
  changedFields: string[];
}

/**
 * List edit history for a check-in (subcollection checkins/{id}/edits).
 * Fetches without orderBy to avoid index requirement; sorts newest first in memory.
 * editedAt returned as ISO string in America/Puerto_Rico.
 * If Firestore/Google auth is unavailable, returns [] so the app can run.
 */
export async function getCheckinEdits(checkinId: string): Promise<CheckinEditRecord[]> {
  let snapshot;
  try {
    const db = getAdminDb();
    const ref = db.collection(CHECKINS_COLLECTION).doc(checkinId).collection(EDITS_SUBCOLLECTION);
    snapshot = await ref.get();
  } catch (err) {
    if (isFirestoreUnavailableError(err)) {
      if (isProduction()) throw err;
      console.warn('Firestore unavailable (getCheckinEdits), returning empty list:', (err as Error).message);
      return [];
    }
    throw err;
  }

  const zone = 'America/Puerto_Rico';
  const records: CheckinEditRecord[] = snapshot.docs.map((doc) => {
    const d = doc.data();
    const editedAtRaw = d.editedAt;
    let editedAtISO = '';
    if (editedAtRaw != null) {
      try {
        const date = typeof editedAtRaw?.toDate === 'function' ? editedAtRaw.toDate() : new Date(editedAtRaw);
        editedAtISO = DateTime.fromJSDate(date, { zone }).toISO() ?? '';
      } catch {
        editedAtISO = String(editedAtRaw);
      }
    }
    return {
      id: doc.id,
      before: (d.before as Record<string, unknown>) ?? {},
      after: (d.after as Record<string, unknown>) ?? {},
      editedAt: editedAtISO,
      editedBy: String(d.editedBy ?? ''),
      changedFields: Array.isArray(d.changedFields) ? (d.changedFields as string[]) : [],
    };
  });
  records.sort((a, b) => (b.editedAt || '').localeCompare(a.editedAt || ''));
  return records;
}

/** Re-export for callers that imported room classification from this module. */
export { isRoomCheckinRecord };

export async function getSummaryMetrics(): Promise<SummaryMetrics> {
  const now = DateTime.now().setZone(ZONE);
  const todayISO = now.toISODate() ?? '';
  const prevWeekStart = getMotelBusinessWeekStart(now, ZONE).minus({ days: 7 });
  const startISO = prevWeekStart.toISODate() ?? '';
  const checkins = await listCheckinsByDateRange(startISO, todayISO);
  return deriveSummaryMetricsFromCheckins(checkins, now);
}

export async function get7DayTrends(): Promise<DashboardData> {
  const now = DateTime.now().setZone(ZONE);
  const prevWeekStart = getMotelBusinessWeekStart(now, ZONE).minus({ days: 7 });
  const startISO = prevWeekStart.toISODate() ?? '';
  const endISO = now.toISODate() ?? '';
  const checkins = await listCheckinsByDateRange(startISO, endISO);
  return deriveMotelWeekTrendComparisonFromCheckins(checkins, now, ZONE);
}

export async function getRoomUsageTop15(): Promise<RoomUsageData> {
  const checkins = await listCheckinsByDateRange();
  const byRoom = new Map<number | string, number>();
  for (const c of checkins) {
    if (!isRoomCheckinRecord(c)) continue;
    const rid = c.room_id;
    if (rid == null || rid === '' || (typeof rid === 'number' && rid <= 0)) continue;
    byRoom.set(rid, (byRoom.get(rid) ?? 0) + getEntryCount(c));
  }
  const sorted = [...byRoom.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  return {
    room_numbers: sorted.map(([id]) => `Room ${id}`),
    usage_counts: sorted.map(([, count]) => count),
  };
}

/**
 * Room usage frequency for one motel business week: top 10 rooms by room check-in count.
 * Includes admin late/past room entries; excludes deleted docs; uses latest saved room_id.
 */
export async function getRoomUsageFrequency(params: {
  weekStart: string;
}): Promise<RoomUsageData> {
  const weekStartISO =
    getMotelBusinessWeekStart(
      DateTime.fromISO(params.weekStart, { zone: ZONE }),
      ZONE
    ).toISODate() ?? params.weekStart;
  const { startISO, endISO } = getMotelBusinessWeekBoundsFromStartIso(weekStartISO, ZONE);

  const checkins = await listCheckinsByDateRange(startISO, endISO);
  return deriveRoomUsageForWeekFromCheckins(checkins, weekStartISO, ZONE);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export async function getMonthlyComparison(
  month: number,
  year: number
): Promise<MonthlyComparisonData> {
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = year - 1;
  }

  const currentMonthStart = `${year}-${month.toString().padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStart = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;
  const prevMonthStart = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-01`;

  const currentMonthEnd = DateTime.fromISO(nextMonthStart, { zone: ZONE }).minus({ days: 1 }).toISODate() ?? currentMonthStart;
  const prevMonthEnd = DateTime.fromISO(currentMonthStart, { zone: ZONE }).minus({ days: 1 }).toISODate() ?? prevMonthStart;

  const [currentCheckins, prevCheckins] = await Promise.all([
    listCheckinsByDateRange(currentMonthStart, currentMonthEnd),
    listCheckinsByDateRange(prevMonthStart, prevMonthEnd),
  ]);

  const currentRevenue = currentCheckins.reduce((sum, c) => sum + c.cost, 0);
  const prevRevenue = prevCheckins.reduce((sum, c) => sum + c.cost, 0);

  const currentRoomCount = currentCheckins.reduce(
    (sum, c) => sum + (isRoomCheckinRecord(c) ? getEntryCount(c) : 0),
    0
  );
  const prevRoomCount = prevCheckins.reduce(
    (sum, c) => sum + (isRoomCheckinRecord(c) ? getEntryCount(c) : 0),
    0
  );

  const years = [year, year - 1].map((y) => y.toString());

  return {
    current_month: {
      name: MONTH_NAMES[month - 1],
      year,
      total: currentRevenue,
      car_count: currentRoomCount,
    },
    prev_month: {
      name: MONTH_NAMES[prevMonth - 1],
      year: prevYear,
      total: prevRevenue,
      car_count: prevRoomCount,
    },
    years_available: years,
  };
}

function sortAndLimitStaffCounts(counts: Map<string, number>, limit = 20): EmployeeRoomCountSeries {
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = entries.slice(0, limit);
  return { labels: top.map(([k]) => k), counts: top.map(([, v]) => v) };
}

/** Raw Firestore doc: room stay vs food/beer (aligns with isRoomCheckinRecord / dashboard metrics). */
function isRoomCheckinDocData(data: Record<string, unknown>): boolean {
  const t = data.checkInType as string | undefined;
  if (t === 'food' || t === 'beer') return false;
  if (t === 'room') return true;
  const lineItems = data.lineItems as unknown[] | undefined;
  const summarized = data.summarizedItems as unknown[] | undefined;
  if (
    (Array.isArray(lineItems) && lineItems.length > 0) ||
    (Array.isArray(summarized) && summarized.length > 0)
  ) {
    return false;
  }
  return true;
}

/**
 * Per-staff room check-ins (check-in date in month) and room cleanups (checkout/cleaned timestamp in month).
 * Cleanups use Firestore `checkedOutAt` range query; if that query fails (e.g. index), cleanups return empty.
 */
export async function getEmployeeRoomActivityForMonth(params: {
  year: number;
  month: number;
}): Promise<EmployeeRoomActivityData> {
  const { year, month } = params;

  const startOfMonth = DateTime.fromObject({ year, month, day: 1 }, { zone: ZONE }).startOf('day');
  const lastDayOfMonth = startOfMonth.plus({ months: 1 }).minus({ days: 1 });
  const startISO = startOfMonth.toISODate() ?? '';
  const endISO = lastDayOfMonth.toISODate() ?? '';

  const checkInList = await listCheckinsByDateRange(startISO, endISO);
  const byStaff = new Map<string, number>();
  for (const c of checkInList) {
    if (!isRoomCheckinRecord(c)) continue;
    const name = (c.staff_name ?? '').trim() || 'Unknown';
    byStaff.set(name, (byStaff.get(name) ?? 0) + getEntryCount(c));
  }
  const check_ins = sortAndLimitStaffCounts(byStaff);

  let cleanups: EmployeeRoomCountSeries = { labels: [], counts: [] };
  try {
    cleanups = await getEmployeeRoomCleanupsForMonth(year, month);
  } catch (err) {
    console.warn(
      'getEmployeeRoomActivityForMonth: cleanups query failed',
      err instanceof Error ? err.message : String(err)
    );
  }

  return { check_ins, cleanups };
}

/**
 * Room cleanups in a calendar month (Firestore `checkedOutAt` range). Used by employee activity and dashboard bundle.
 */
export async function getEmployeeRoomCleanupsForMonth(
  year: number,
  month: number
): Promise<EmployeeRoomCountSeries> {
  const startOfMonth = DateTime.fromObject({ year, month, day: 1 }, { zone: ZONE }).startOf('day');
  const endExclusive = startOfMonth.plus({ months: 1 });
  const startTs = Timestamp.fromDate(startOfMonth.toJSDate());
  const endTs = Timestamp.fromDate(endExclusive.toJSDate());
  const db = getAdminDb();
  const snap = await db
    .collection(CHECKINS_COLLECTION)
    .where('checkedOutAt', '>=', startTs)
    .where('checkedOutAt', '<', endTs)
    .orderBy('checkedOutAt', 'asc')
    .get();
  const byCleaner = new Map<string, number>();
  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (!isRoomCheckinDocData(data)) continue;
    const cleanedBy = typeof data.cleanedBy === 'string' ? data.cleanedBy.trim() : '';
    if (!cleanedBy) continue;
    byCleaner.set(cleanedBy, (byCleaner.get(cleanedBy) ?? 0) + 1);
  }
  return sortAndLimitStaffCounts(byCleaner);
}
