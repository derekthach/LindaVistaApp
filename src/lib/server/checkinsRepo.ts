import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { DateTime } from 'luxon';
import { getAdminDb } from './firebaseAdmin';
import { isFirestoreUnavailableError, isProduction } from './firestoreError';
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
  roundMoney,
} from '@/lib/checkins/roomPaymentSplits';
import { sortRoomsForDisplay } from '@/lib/checkins/roomOccupancy';
import { dedupeActiveRoomStaySnapshots } from '@/lib/server/activeRoomStayDedupe';
import { logInfo } from '@/lib/server/log';

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

  return result.receiptNumber;
}

export interface CreateSimpleCheckinInput {
  date: string;
  time: string;
  staff_name: string;
  lineItems: LineItem[];
  summarizedItems: SummarizedItem[];
  notes?: string;
  employee_id?: string;
  employee_name_snapshot?: string;
  created_by_role?: 'admin' | 'employee';
}

/** Create a food or beer check-in (same collection, checkInType set, lineItems + summarizedItems + notes). Uses settings/receipts for next number. */
export async function createSimpleCheckin(
  checkInType: 'food' | 'beer',
  data: CreateSimpleCheckinInput
): Promise<string> {
  const db = getAdminDb();
  const settingsRef = db.collection(SETTINGS_COLLECTION).doc(RECEIPTS_DOC_ID);
  const counterRef = db.collection(COUNTERS_COLLECTION).doc(RECEIPT_COUNTER_ID);
  const checkinsRef = db.collection(CHECKINS_COLLECTION);

  const result = await db.runTransaction(async (tx) => {
    let nextNum: number;
    const settingsSnap = await tx.get(settingsRef);
    if (settingsSnap.exists) {
      nextNum = (settingsSnap.data()?.nextReceiptNumber as number) ?? 0;
    } else {
      const counterSnap = await tx.get(counterRef);
      nextNum = counterSnap.exists
        ? (counterSnap.data()?.nextReceiptNumber as number) ?? 1
        : 1;
    }
    const receiptNumber = formatReceiptNumber(nextNum);
    const nextReceiptNumber = nextNum + 1;

    const dt = DateTime.fromFormat(
      `${data.date} ${data.time}`,
      'yyyy-MM-dd HH:mm',
      { zone: 'America/Puerto_Rico' }
    );
    const checkInAt = dt.isValid ? Timestamp.fromDate(dt.toJSDate()) : Timestamp.now();

    const doc: Record<string, unknown> = {
      receiptNumber,
      checkInAt,
      createdAt: Timestamp.now(),
      checkInType,
      staffName: data.staff_name,
      lineItems: data.lineItems,
      summarizedItems: data.summarizedItems,
      note: data.notes ?? '',
    };

    if (data.employee_id) doc.employeeId = data.employee_id;
    if (data.employee_name_snapshot) doc.employeeNameSnapshot = data.employee_name_snapshot;
    if (data.created_by_role) doc.createdByRole = data.created_by_role;

    tx.set(settingsRef, { nextReceiptNumber }, { merge: true });
    const newRef = checkinsRef.doc();
    tx.set(newRef, doc);
    return { id: newRef.id, receiptNumber };
  });

  return result.receiptNumber;
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

/** Timestamp for "creation" sort: createdAt if present, else checkInAt (for legacy docs). */
function getCreationTime(data: Record<string, unknown>): number {
  const created = (data.createdAt as Timestamp | undefined)?.toDate?.();
  const checkIn = (data.checkInAt as Timestamp | undefined)?.toDate?.();
  const d = created ?? checkIn ?? new Date(0);
  return d.getTime();
}

/**
 * List check-ins in a date range. Dates are YYYY-MM-DD and interpreted in America/Puerto_Rico.
 * - Filtered (startISO and endISO provided): filter by business date (checkInAt), order by checkInAt desc.
 * - Unfiltered (both omitted): return recent records ordered by creation/submission time desc (createdAt, with fallback to checkInAt for legacy docs).
 * If Firestore/Google auth is unavailable, returns [] so the app can run.
 */
export async function listCheckinsByDateRange(
  startISO?: string,
  endISO?: string
): Promise<CheckIn[]> {
  try {
    const db = getAdminDb();
    const now = DateTime.now().setZone('America/Puerto_Rico');
    const filteredMode = startISO != null && startISO !== '' && endISO != null && endISO !== '';

    const start = startISO
      ? Timestamp.fromDate(startOfDayISO(startISO))
      : Timestamp.fromDate(new Date(0));
    const endExclusive = endISO
      ? Timestamp.fromDate(endExclusiveISO(endISO))
      : Timestamp.fromDate(now.plus({ years: 1 }).toJSDate());

    let query = db
      .collection(CHECKINS_COLLECTION)
      .where('checkInAt', '>=', start)
      .where('checkInAt', '<', endExclusive)
      .orderBy('checkInAt', 'desc');
    if (!filteredMode) {
      query = query.limit(UNFILTERED_LIMIT);
    }
    const snapshot = await query.get();

    const docs = snapshot.docs;
    if (filteredMode) {
      return docs.map((doc) => normalizeCheckin(doc.id, doc.data()));
    }
    const sorted = [...docs].sort((a, b) => getCreationTime(b.data()) - getCreationTime(a.data()));
    return sorted.map((doc) => normalizeCheckin(doc.id, doc.data()));
  } catch (err) {
    if (isFirestoreUnavailableError(err)) {
      if (isProduction()) throw err;
      console.warn('Firestore unavailable (listCheckinsByDateRange), returning empty list:', (err as Error).message);
      return [];
    }
    throw err;
  }
}

export async function deleteCheckinById(id: string): Promise<void> {
  const db = getAdminDb();
  const ref = db.collection(CHECKINS_COLLECTION).doc(id);
  await ref.delete();
}

/**
 * Room stays awaiting checkout: checkInType room and isCheckedOut === false. Sorted by room number.
 * Legacy room docs without isCheckedOut are excluded (not considered active stays).
 *
 * Defensive: if multiple active docs exist for the same room (historical double-writes), only the
 * canonical stay (newest by max(createdAt, checkInAt)) is returned so checkout tiles stay unique.
 */
export async function listActiveOccupiedRoomCheckins(): Promise<CheckIn[]> {
  try {
    const db = getAdminDb();
    const snapshot = await db
      .collection(CHECKINS_COLLECTION)
      .where('checkInType', '==', 'room')
      .where('isCheckedOut', '==', false)
      .get();
    const canonicalDocs = dedupeActiveRoomStaySnapshots(snapshot.docs);
    const list = canonicalDocs.map((doc) => normalizeCheckin(doc.id, doc.data()));
    return sortRoomsForDisplay(list);
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

export interface UpdateCheckinInput {
  receipt_number: string;
  staff_name: string;
  room_id?: number | string;
  payment_splits: RoomPaymentSplit[];
}

/**
 * Update check-in editable fields. Does not change checkInAt.
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
  const checkInType = (data.checkInType as string) ?? 'room';
  if (checkInType !== 'room') {
    throw new Error('Check-in is not a room record');
  }

  const receiptNumber = formatReceiptNumber(payload.receipt_number);
  const splits = payload.payment_splits;
  const totalAfter = roundMoney(calculatePaymentSplitTotal(splits));
  const breakdownAfter = formatPaymentBreakdownComma(splits);

  const before: Record<string, unknown> = {
    receiptNumber: data.receiptNumber ?? '',
    staffName: data.staffName ?? '',
    roomId: data.roomId != null && data.roomId !== '' ? data.roomId : 0,
    paymentBreakdown: formatPaymentBreakdownForAuditDoc(data),
    totalCollected: getRoomCollectedTotalFromDoc(data),
  };
  const after: Record<string, unknown> = {
    receiptNumber,
    staffName: payload.staff_name,
    roomId: payload.room_id ?? 0,
    paymentBreakdown: breakdownAfter,
    totalCollected: totalAfter,
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
    console.error('checkinsRepo.updateCheckin: audit write failed', auditErr);
  }
}

export interface UpdateCheckinFoodBeerInput {
  receipt_number: string;
  staff_name: string;
  itemId: string;
  itemLabel: string;
  quantity: number;
  amountCollected: number;
}

/**
 * Update food/beer check-in. Persists lineItems and summarizedItems (single item).
 * Cost is derived on read via totalAmountCollected; dashboard will reflect new totals after refresh.
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
  const checkInType = (data.checkInType as string) ?? 'room';
  if (checkInType !== 'food' && checkInType !== 'beer') {
    throw new Error('Check-in is not food or beer');
  }

  const receiptNumber = formatReceiptNumber(payload.receipt_number);
  const itemId = payload.itemId.trim();
  const itemLabel = payload.itemLabel.trim() || itemId;
  const lineItems: LineItem[] = [
    {
      itemId,
      itemLabel,
      quantitySold: payload.quantity,
      amountCollected: payload.amountCollected,
    },
  ];
  const summarizedItems: SummarizedItem[] = [
    {
      itemId,
      itemLabel,
      totalQuantitySold: payload.quantity,
      totalAmountCollected: payload.amountCollected,
    },
  ];

  const existingLineItems = (data.lineItems as LineItem[] | undefined) ?? [];
  const existingSummarized = (data.summarizedItems as SummarizedItem[] | undefined) ?? [];
  const firstLine = existingLineItems[0];
  const firstSum = existingSummarized[0];
  const before: Record<string, unknown> = {
    receiptNumber: data.receiptNumber ?? '',
    staffName: data.staffName ?? '',
    item: firstLine?.itemLabel ?? firstSum?.itemLabel ?? '',
    quantity: firstLine?.quantitySold ?? firstSum?.totalQuantitySold ?? 0,
    amountCollected: firstLine?.amountCollected ?? firstSum?.totalAmountCollected ?? 0,
  };
  const after: Record<string, unknown> = {
    receiptNumber,
    staffName: payload.staff_name,
    item: itemLabel,
    quantity: payload.quantity,
    amountCollected: payload.amountCollected,
  };
  const changedFields: string[] = [];
  if (String(before.receiptNumber) !== String(after.receiptNumber)) changedFields.push('receiptNumber');
  if (String(before.staffName) !== String(after.staffName)) changedFields.push('staffName');
  if (String(before.item) !== String(after.item)) changedFields.push('item');
  if (Number(before.quantity) !== Number(after.quantity)) changedFields.push('quantity');
  if (Number(before.amountCollected) !== Number(after.amountCollected)) changedFields.push('amountCollected');

  if (changedFields.length === 0) {
    return;
  }

  const updateData: Record<string, unknown> = {
    receiptNumber,
    staffName: payload.staff_name,
    lineItems,
    summarizedItems,
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
    console.error('checkinsRepo.updateCheckinFoodBeer: audit write failed', auditErr);
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

const ZONE = 'America/Puerto_Rico';

/**
 * Guest room stays only for dashboard counts (excludes food/beer).
 * - Explicit food/beer → excluded.
 * - Explicit room → included.
 * - Legacy without checkInType: excluded if line/summary item rows exist (typical F&B shape); else treated as room.
 */
function isRoomCheckinRecord(c: CheckIn): boolean {
  if (c.checkInType === 'food' || c.checkInType === 'beer') return false;
  if (c.checkInType === 'room') return true;
  const hasItemData =
    (Array.isArray(c.lineItems) && c.lineItems.length > 0) ||
    (Array.isArray(c.summarizedItems) && c.summarizedItems.length > 0);
  if (hasItemData) return false;
  return true;
}

export async function getSummaryMetrics(): Promise<SummaryMetrics> {
  const now = DateTime.now().setZone(ZONE);
  const todayISO = now.toISODate() ?? '';
  const startOfWeekISO = now.startOf('week').toISODate() ?? '';

  const [todayCheckins, weekCheckins] = await Promise.all([
    listCheckinsByDateRange(todayISO, todayISO),
    listCheckinsByDateRange(startOfWeekISO, todayISO),
  ]);

  const profitToday = todayCheckins.reduce((sum, c) => sum + c.cost, 0);
  const profitThisWeek = weekCheckins.reduce((sum, c) => sum + c.cost, 0);

  const roomToday = todayCheckins.filter(isRoomCheckinRecord);
  const roomWeek = weekCheckins.filter(isRoomCheckinRecord);

  return {
    carsToday: roomToday.length,
    carsThisWeek: roomWeek.length,
    profitToday,
    profitThisWeek,
  };
}

export async function get7DayTrends(): Promise<DashboardData> {
  const endDate = DateTime.now().setZone(ZONE);
  const startDate = endDate.minus({ days: 6 });
  const startISO = startDate.toISODate() ?? '';
  const endISO = endDate.toISODate() ?? '';

  const checkins = await listCheckinsByDateRange(startISO, endISO);
  const byDay = new Map<string, { count: number; revenue: number }>();

  let current = startDate;
  while (current <= endDate) {
    const key = current.toISODate() ?? '';
    byDay.set(key, { count: 0, revenue: 0 });
    current = current.plus({ days: 1 });
  }

  for (const c of checkins) {
    const key = c.date;
    const cell = byDay.get(key);
    if (cell) {
      if (isRoomCheckinRecord(c)) {
        cell.count += 1;
      }
      cell.revenue += c.cost;
    }
  }

  const dates: string[] = [];
  const checkinsArr: number[] = [];
  const revenue: number[] = [];
  current = startDate;
  while (current <= endDate) {
    dates.push(current.toFormat('MM/dd'));
    const key = current.toISODate() ?? '';
    const cell = byDay.get(key) ?? { count: 0, revenue: 0 };
    checkinsArr.push(cell.count);
    revenue.push(cell.revenue);
    current = current.plus({ days: 1 });
  }

  return { dates, checkins: checkinsArr, revenue };
}

export async function getRoomUsageTop15(): Promise<RoomUsageData> {
  const checkins = await listCheckinsByDateRange();
  const byRoom = new Map<number | string, number>();
  for (const c of checkins) {
    const rid = c.room_id;
    if (rid == null || rid === '' || (typeof rid === 'number' && rid <= 0)) continue;
    byRoom.set(rid, (byRoom.get(rid) ?? 0) + 1);
  }
  const sorted = [...byRoom.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  return {
    room_numbers: sorted.map(([id]) => `Room ${id}`),
    usage_counts: sorted.map(([, count]) => count),
  };
}

/**
 * Room usage frequency for a single month: top 15 rooms by check-in count.
 * Only checkInType === 'room'. Excludes room 0 and invalid/missing room numbers.
 * Date range: startOfMonth (inclusive) to startOfNextMonth (exclusive) in America/Puerto_Rico.
 * Uses listCheckinsByDateRange (index on checkInAt only) then filters in memory to avoid a composite index.
 */
export async function getRoomUsageFrequency(params: {
  year: number;
  month: number; // 1-12
}): Promise<RoomUsageData> {
  const { year, month } = params;

  const startOfMonth = DateTime.fromObject(
    { year, month, day: 1 },
    { zone: ZONE }
  ).startOf('day');
  const lastDayOfMonth = startOfMonth.plus({ months: 1 }).minus({ days: 1 });

  const startISO = startOfMonth.toISODate() ?? '';
  const endISO = lastDayOfMonth.toISODate() ?? '';

  const checkins = await listCheckinsByDateRange(startISO, endISO);

  const byRoom = new Map<number | string, number>();
  for (const c of checkins) {
    if (c.checkInType !== 'room') continue;
    const roomId = c.room_id;
    if (roomId == null || roomId === '' || (typeof roomId === 'number' && (Number.isNaN(roomId) || roomId <= 0))) continue;
    byRoom.set(roomId, (byRoom.get(roomId) ?? 0) + 1);
  }

  const sorted = [...byRoom.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  return {
    room_numbers: sorted.map(([id]) => `Room ${id}`),
    usage_counts: sorted.map(([, count]) => count),
  };
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

  const currentRoomCount = currentCheckins.filter(isRoomCheckinRecord).length;
  const prevRoomCount = prevCheckins.filter(isRoomCheckinRecord).length;

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
    byStaff.set(name, (byStaff.get(name) ?? 0) + 1);
  }
  const check_ins = sortAndLimitStaffCounts(byStaff);

  let cleanups: EmployeeRoomCountSeries = { labels: [], counts: [] };
  try {
    const db = getAdminDb();
    const endExclusive = startOfMonth.plus({ months: 1 });
    const startTs = Timestamp.fromDate(startOfMonth.toJSDate());
    const endTs = Timestamp.fromDate(endExclusive.toJSDate());
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
    cleanups = sortAndLimitStaffCounts(byCleaner);
  } catch (err) {
    console.warn(
      'getEmployeeRoomActivityForMonth: cleanups query failed',
      err instanceof Error ? err.message : String(err)
    );
  }

  return { check_ins, cleanups };
}
