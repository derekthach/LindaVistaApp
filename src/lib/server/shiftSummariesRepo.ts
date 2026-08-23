import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { DateTime } from 'luxon';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { isFirestoreUnavailableError, isProduction } from '@/lib/server/firestoreError';
import { logInfo } from '@/lib/server/log';
import {
  calculateDayShiftSummaries,
  getBusinessDateWindow,
  SHIFT_IDS,
  shiftSummaryDocId,
  type RoomTurnoverRecord,
  type ShiftId,
  type ShiftSummary,
} from '@/lib/shifts';
import { listCheckinsByDateRange } from '@/lib/server/checkinsRepo';
import type { CheckIn } from '@/types';

const SHIFT_SUMMARIES_COLLECTION = 'shiftSummaries';
const CHECKINS_COLLECTION = 'checkins';
const ZONE = 'America/Puerto_Rico';

/** Aligns with checkinsRepo.isRoomCheckinDocData / isRoomCheckinRecord. */
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
 * Bounded retrieval of room stays cleaned in [start, end).
 * Uses `cleanedAt` when present; falls back to `checkedOutAt` (V1 checkout sets both equal).
 * Same collection as View Check-Ins — not a separate rooms collection.
 */
export async function listRoomTurnoversByCleanedAtRange(
  start: Date,
  end: Date
): Promise<RoomTurnoverRecord[]> {
  const started = Date.now();
  try {
    const db = getAdminDb();
    const startTs = Timestamp.fromDate(start);
    const endTs = Timestamp.fromDate(end);

    let snap;
    try {
      snap = await db
        .collection(CHECKINS_COLLECTION)
        .where('cleanedAt', '>=', startTs)
        .where('cleanedAt', '<', endTs)
        .orderBy('cleanedAt', 'asc')
        .get();
    } catch (cleanedAtErr) {
      // Fallback: production already indexes checkedOutAt for employee cleanups.
      console.warn(
        'listRoomTurnoversByCleanedAtRange: cleanedAt query failed, falling back to checkedOutAt',
        cleanedAtErr instanceof Error ? cleanedAtErr.message : String(cleanedAtErr)
      );
      snap = await db
        .collection(CHECKINS_COLLECTION)
        .where('checkedOutAt', '>=', startTs)
        .where('checkedOutAt', '<', endTs)
        .orderBy('checkedOutAt', 'asc')
        .get();
    }

    const turnovers: RoomTurnoverRecord[] = [];
    for (const doc of snap.docs) {
      const data = doc.data() as Record<string, unknown>;
      if (!isRoomCheckinDocData(data)) continue;
      if (data.isPastEntry === true) continue;
      if (data.isCheckedOut !== true) continue;

      const checkedOutAt = timestampToDate(data.checkedOutAt);
      const cleanedAt = timestampToDate(data.cleanedAt) ?? checkedOutAt;
      if (!checkedOutAt || !cleanedAt) continue;

      turnovers.push({ id: doc.id, checkedOutAt, cleanedAt });
    }

    logInfo('shiftSummaries.turnovers.complete', {
      docsReturned: turnovers.length,
      elapsedMs: Date.now() - started,
    });
    return turnovers;
  } catch (err) {
    if (isFirestoreUnavailableError(err)) {
      if (isProduction()) throw err;
      console.warn(
        'Firestore unavailable (listRoomTurnoversByCleanedAtRange), returning []:',
        (err as Error).message
      );
      return [];
    }
    throw err;
  }
}

/** Turnovers for one Puerto Rico business date operational window [00:00, next day 00:00). */
export async function listRoomTurnoversForBusinessDate(
  businessDate: string
): Promise<RoomTurnoverRecord[]> {
  const { start, end } = getBusinessDateWindow(businessDate);
  return listRoomTurnoversByCleanedAtRange(start, end);
}

/**
 * Future Cron / server path: bounded check-in window for a completed shift.
 * Does not replace Admin UI reuse of already-loaded day records.
 */
export async function getShiftCheckinRecords(
  shiftStart: Date,
  shiftEnd: Date
): Promise<CheckIn[]> {
  const startISO =
    DateTime.fromJSDate(shiftStart, { zone: ZONE }).toISODate() ?? '';
  const endISO =
    DateTime.fromJSDate(new Date(shiftEnd.getTime() - 1), { zone: ZONE }).toISODate() ??
    startISO;
  const checkins = await listCheckinsByDateRange(startISO, endISO);
  return checkins.filter((c) => {
    const dt = DateTime.fromISO(`${c.date}T${c.time}`, { zone: ZONE });
    if (!dt.isValid) return false;
    const t = dt.toJSDate().getTime();
    return t >= shiftStart.getTime() && t < shiftEnd.getTime();
  });
}

/** Derive turnover records from already-normalized check-ins that carry ISO checkout fields. */
export function turnoversFromCheckins(checkins: CheckIn[]): RoomTurnoverRecord[] {
  const out: RoomTurnoverRecord[] = [];
  for (const c of checkins) {
    if (!c.id || c.is_past_entry) continue;
    if (c.is_checked_out !== true) continue;
    const cleanedIso = c.cleaned_at_iso ?? c.checked_out_at_iso;
    const checkedOutIso = c.checked_out_at_iso;
    if (!cleanedIso || !checkedOutIso) continue;
    const cleanedAt = new Date(cleanedIso);
    const checkedOutAt = new Date(checkedOutIso);
    if (Number.isNaN(cleanedAt.getTime()) || Number.isNaN(checkedOutAt.getTime())) continue;
    out.push({ id: c.id, checkedOutAt, cleanedAt });
  }
  return out;
}

export async function saveShiftSummary(summary: ShiftSummary): Promise<void> {
  const db = getAdminDb();
  const id = shiftSummaryDocId(summary.businessDate, summary.shift);
  const ref = db.collection(SHIFT_SUMMARIES_COLLECTION).doc(id);
  await ref.set(
    {
      businessDate: summary.businessDate,
      shift: summary.shift,
      shiftStart: Timestamp.fromDate(summary.shiftStart),
      shiftEnd: Timestamp.fromDate(summary.shiftEnd),
      totalRevenue: summary.totalRevenue,
      totalCars: summary.totalCars,
      roomsTurnedOver: summary.roomsTurnedOver,
      timezone: summary.timezone,
      generatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Admin / test: compute all three shifts for a business date and upsert
 * shiftSummaries/{date}_{shift}. Does not run on normal Admin page render.
 */
export async function generateAndSaveShiftSummariesForBusinessDate(
  businessDate: string
): Promise<ShiftSummary[]> {
  const [checkins, turnovers] = await Promise.all([
    listCheckinsByDateRange(businessDate, businessDate),
    listRoomTurnoversForBusinessDate(businessDate),
  ]);
  const summaries = calculateDayShiftSummaries(businessDate, checkins, turnovers);
  for (const summary of summaries) {
    await saveShiftSummary(summary);
  }
  return summaries.map((s) => ({ ...s, generatedAt: new Date() }));
}

export async function getPersistedShiftSummary(
  businessDate: string,
  shift: ShiftId
): Promise<ShiftSummary | null> {
  const db = getAdminDb();
  const snap = await db
    .collection(SHIFT_SUMMARIES_COLLECTION)
    .doc(shiftSummaryDocId(businessDate, shift))
    .get();
  if (!snap.exists) return null;
  const data = snap.data() as Record<string, unknown>;
  const shiftStart = timestampToDate(data.shiftStart);
  const shiftEnd = timestampToDate(data.shiftEnd);
  const generatedAt = timestampToDate(data.generatedAt);
  if (!shiftStart || !shiftEnd) return null;
  if (!SHIFT_IDS.includes(data.shift as ShiftId)) return null;
  return {
    businessDate: String(data.businessDate ?? businessDate),
    shift: data.shift as ShiftId,
    shiftStart,
    shiftEnd,
    totalRevenue: Number(data.totalRevenue) || 0,
    totalCars: Number(data.totalCars) || 0,
    roomsTurnedOver: Number(data.roomsTurnedOver) || 0,
    timezone: 'America/Puerto_Rico',
    ...(generatedAt ? { generatedAt } : {}),
  };
}

function timestampToDate(raw: unknown): Date | undefined {
  if (raw == null) return undefined;
  if (typeof (raw as { toDate?: () => Date }).toDate === 'function') {
    const d = (raw as { toDate: () => Date }).toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : undefined;
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
  return undefined;
}
