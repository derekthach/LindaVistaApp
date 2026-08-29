import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { isFirestoreUnavailableError, isProduction } from '@/lib/server/firestoreError';
import { logInfo } from '@/lib/server/log';
import {
  calculateShiftSummary,
  getBusinessDateWindow,
  getShiftWindow,
  SHIFT_IDS,
  shiftSummaryDocId,
  type RoomTurnoverRecord,
  type ShiftId,
  type ShiftSummary,
} from '@/lib/shifts';
import { listCheckinsByDateRange, listCheckinsByInstantRange } from '@/lib/server/checkinsRepo';
import type { CheckIn } from '@/types';

const SHIFT_SUMMARIES_COLLECTION = 'shiftSummaries';
const CHECKINS_COLLECTION = 'checkins';

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
 * Bounded check-in window for one completed shift: checkInAt in [shiftStart, shiftEnd).
 */
export async function getShiftCheckinRecords(
  shiftStart: Date,
  shiftEnd: Date
): Promise<CheckIn[]> {
  return listCheckinsByInstantRange(shiftStart, shiftEnd);
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
      roomCents: summary.roomCents,
      foodCents: summary.foodCents,
      beerCents: summary.beerCents,
      totalCars: summary.totalCars,
      roomsTurnedOver: summary.roomsTurnedOver,
      timezone: summary.timezone,
      generatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export type GenerateShiftSummaryForPeriodInput = {
  businessDate: string;
  shift: ShiftId;
  /**
   * Optional preloaded day (or larger) check-ins — skips the shift-bounded checkInAt query.
   * Used by Admin full-day regenerate for read efficiency.
   */
  checkins?: CheckIn[];
  /** Optional preloaded turnovers — skips the shift-bounded cleanedAt query. */
  turnovers?: RoomTurnoverRecord[];
};

/**
 * Shared Shift Summary generation used by Admin and Vercel Cron.
 * Without preloaded data: ONE bounded checkInAt query + ONE bounded cleanedAt query for the shift window.
 * Then calculateShiftSummary() + saveShiftSummary() (deterministic doc id — idempotent).
 */
export async function generateAndSaveShiftSummaryForPeriod(
  input: GenerateShiftSummaryForPeriodInput
): Promise<ShiftSummary> {
  const { businessDate, shift } = input;
  const window = getShiftWindow(businessDate, shift);

  const [checkins, turnovers] = await Promise.all([
    input.checkins != null
      ? Promise.resolve(input.checkins)
      : listCheckinsByInstantRange(window.shiftStart, window.shiftEnd),
    input.turnovers != null
      ? Promise.resolve(input.turnovers)
      : listRoomTurnoversByCleanedAtRange(window.shiftStart, window.shiftEnd),
  ]);

  const summary = calculateShiftSummary({
    businessDate,
    shift,
    checkins,
    turnovers,
  });
  await saveShiftSummary(summary);
  return { ...summary, generatedAt: new Date() };
}

/**
 * Admin / test: compute all three shifts for a business date and upsert
 * shiftSummaries/{date}_{shift}. Uses one day-level check-in + turnover fetch,
 * then the shared per-shift calculate + save path (no Cron HTTP).
 */
export async function generateAndSaveShiftSummariesForBusinessDate(
  businessDate: string
): Promise<{ summaries: ShiftSummary[]; checkins: CheckIn[] }> {
  const [checkins, turnovers] = await Promise.all([
    listCheckinsByDateRange(businessDate, businessDate),
    listRoomTurnoversForBusinessDate(businessDate),
  ]);
  const summaries: ShiftSummary[] = [];
  for (const shift of SHIFT_IDS) {
    summaries.push(
      await generateAndSaveShiftSummaryForPeriod({
        businessDate,
        shift,
        checkins,
        turnovers,
      })
    );
  }
  return { summaries, checkins };
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
    roomCents: Number(data.roomCents) || 0,
    foodCents: Number(data.foodCents) || 0,
    beerCents: Number(data.beerCents) || 0,
    totalCars: Number(data.totalCars) || 0,
    roomsTurnedOver: Number(data.roomsTurnedOver) || 0,
    timezone: 'America/Puerto_Rico',
    ...(generatedAt ? { generatedAt } : {}),
  };
}

/**
 * Load overnight/day/evening persisted docs for one business date (exactly 3 document gets).
 * Missing docs return as null slots — callers must not treat null as zero activity.
 */
export async function getPersistedShiftSummariesForBusinessDate(businessDate: string): Promise<{
  summaries: ShiftSummary[];
  missingShifts: ShiftId[];
}> {
  const results = await Promise.all(
    SHIFT_IDS.map((shift) => getPersistedShiftSummary(businessDate, shift))
  );
  const summaries: ShiftSummary[] = [];
  const missingShifts: ShiftId[] = [];
  for (let i = 0; i < SHIFT_IDS.length; i++) {
    const row = results[i];
    if (row) summaries.push(row);
    else missingShifts.push(SHIFT_IDS[i]!);
  }
  return { summaries, missingShifts };
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
