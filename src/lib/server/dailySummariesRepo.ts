import {
  calculateDailySummary,
  dailySummaryDocId,
  dailySummaryHasViewCheckinsBreakdown,
  formatMissingShiftSummariesError,
  isCompleteDailySummary,
  SHIFT_IDS,
  type DailySummary,
  type ShiftId,
  type ShiftSummary,
} from '@/lib/shifts';
import { buildSectionedData, type SectionTotals } from '@/lib/checkins/sectioning';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { HttpError } from '@/lib/server/httpError';
import { logInfo } from '@/lib/server/log';
import { getPersistedShiftSummary } from '@/lib/server/shiftSummariesRepo';
import { listCheckinsByDateRange } from '@/lib/server/checkinsRepo';
import type { CheckIn } from '@/types';

const DAILY_SUMMARIES_COLLECTION = 'dailySummaries';

function emptySectionTotals(): SectionTotals {
  return { roomCents: 0, foodCents: 0, beerCents: 0, totalCents: 0, carCount: 0 };
}

function parseSectionTotals(raw: unknown): SectionTotals | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return {
    roomCents: Number(o.roomCents) || 0,
    foodCents: Number(o.foodCents) || 0,
    beerCents: Number(o.beerCents) || 0,
    totalCents: Number(o.totalCents) || 0,
    carCount: Number(o.carCount) || 0,
  };
}

export function viewCheckinsInputFromCheckins(
  checkins: CheckIn[],
  sectioned = buildSectionedData(checkins)
) {
  return {
    checkinCount: checkins.length,
    viewCheckinsSections: [
      sectioned.sectionTotals[0] ?? emptySectionTotals(),
      sectioned.sectionTotals[1] ?? emptySectionTotals(),
      sectioned.sectionTotals[2] ?? emptySectionTotals(),
    ] as [SectionTotals, SectionTotals, SectionTotals],
    viewCheckinsDayTotals: sectioned.dayTotals,
  };
}

export async function saveDailySummary(summary: DailySummary): Promise<void> {
  if (summary.status !== 'complete') {
    throw new HttpError(400, 'INCOMPLETE_DAILY_SUMMARY');
  }
  const db = getAdminDb();
  const id = dailySummaryDocId(summary.businessDate);
  await db
    .collection(DAILY_SUMMARIES_COLLECTION)
    .doc(id)
    .set(
      {
        businessDate: summary.businessDate,
        totalRevenue: summary.totalRevenue,
        roomCents: summary.roomCents,
        foodCents: summary.foodCents,
        beerCents: summary.beerCents,
        totalCars: summary.totalCars,
        roomsTurnedOver: summary.roomsTurnedOver,
        checkinCount: summary.checkinCount,
        viewCheckinsSections: summary.viewCheckinsSections,
        viewCheckinsDayTotals: summary.viewCheckinsDayTotals,
        timezone: summary.timezone,
        status: 'complete',
        shiftSummaryIds: summary.shiftSummaryIds,
        generatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

export async function getPersistedDailySummary(businessDate: string): Promise<DailySummary | null> {
  const db = getAdminDb();
  const snap = await db.collection(DAILY_SUMMARIES_COLLECTION).doc(dailySummaryDocId(businessDate)).get();
  if (!snap.exists) return null;
  const data = snap.data() as Record<string, unknown>;
  const shiftSummaryIds = data.shiftSummaryIds as DailySummary['shiftSummaryIds'] | undefined;
  if (!shiftSummaryIds?.overnight || !shiftSummaryIds?.day || !shiftSummaryIds?.evening) {
    return null;
  }

  const generatedAt =
    data.generatedAt && typeof (data.generatedAt as { toDate?: () => Date }).toDate === 'function'
      ? (data.generatedAt as { toDate: () => Date }).toDate()
      : undefined;

  const empty = emptySectionTotals();
  let viewCheckinsSections: [SectionTotals, SectionTotals, SectionTotals] = [
    { ...empty },
    { ...empty },
    { ...empty },
  ];
  let viewCheckinsDayTotals = { ...empty };
  let checkinCount = Number(data.checkinCount) || 0;
  let roomCents = Number(data.roomCents);
  let foodCents = Number(data.foodCents);
  let beerCents = Number(data.beerCents);

  if (dailySummaryHasViewCheckinsBreakdown(data)) {
    const sectionsRaw = data.viewCheckinsSections as unknown[];
    const s0 = parseSectionTotals(sectionsRaw[0]);
    const s1 = parseSectionTotals(sectionsRaw[1]);
    const s2 = parseSectionTotals(sectionsRaw[2]);
    const dayTotals = parseSectionTotals(data.viewCheckinsDayTotals);
    if (s0 && s1 && s2 && dayTotals) {
      viewCheckinsSections = [s0, s1, s2];
      viewCheckinsDayTotals = dayTotals;
    }
  } else {
    // Legacy docs (pre–View Check-ins breakdown): keep SMS-readable totals.
    const legacyTotalCents = Math.round((Number(data.totalRevenue) || 0) * 100);
    if (!Number.isFinite(roomCents)) roomCents = legacyTotalCents;
    if (!Number.isFinite(foodCents)) foodCents = 0;
    if (!Number.isFinite(beerCents)) beerCents = 0;
  }

  return {
    businessDate: String(data.businessDate ?? businessDate),
    totalRevenue: Number(data.totalRevenue) || 0,
    roomCents: Number.isFinite(roomCents) ? roomCents : 0,
    foodCents: Number.isFinite(foodCents) ? foodCents : 0,
    beerCents: Number.isFinite(beerCents) ? beerCents : 0,
    totalCars: Number(data.totalCars) || 0,
    roomsTurnedOver: Number(data.roomsTurnedOver) || 0,
    checkinCount,
    viewCheckinsSections,
    viewCheckinsDayTotals,
    timezone: 'America/Puerto_Rico',
    status: 'complete',
    shiftSummaryIds,
    ...(generatedAt ? { generatedAt } : {}),
  };
}

/** Like {@link getPersistedDailySummary} but only when View Check-ins section fields are present. */
export async function getPersistedDailySummaryForViewCheckins(
  businessDate: string
): Promise<DailySummary | null> {
  const db = getAdminDb();
  const snap = await db.collection(DAILY_SUMMARIES_COLLECTION).doc(dailySummaryDocId(businessDate)).get();
  if (!snap.exists) return null;
  if (!dailySummaryHasViewCheckinsBreakdown(snap.data() as Record<string, unknown>)) {
    return null;
  }
  return getPersistedDailySummary(businessDate);
}

/**
 * Prefer reading persisted Shift Summary docs — does not reread `/checkins` for shifts,
 * but loads the day's check-ins once to attach View Check-ins section breakdown.
 */
export async function generateAndSaveDailySummaryForBusinessDate(
  businessDate: string,
  knownSummaries?: Partial<Record<ShiftId, ShiftSummary>>
): Promise<DailySummary> {
  const started = Date.now();

  const rows = await Promise.all(
    SHIFT_IDS.map(async (shift) => {
      const known = knownSummaries?.[shift];
      if (known) return known;
      return getPersistedShiftSummary(businessDate, shift);
    })
  );

  const summaries: ShiftSummary[] = [];
  const missingShifts: ShiftId[] = [];
  for (let i = 0; i < SHIFT_IDS.length; i++) {
    const row = rows[i];
    if (row) summaries.push(row);
    else missingShifts.push(SHIFT_IDS[i]!);
  }

  if (missingShifts.length > 0) {
    throw new HttpError(409, 'MISSING_SHIFT_SUMMARIES', {
      message: formatMissingShiftSummariesError(businessDate, missingShifts),
      businessDate,
      missingShifts,
    });
  }

  const checkins = await listCheckinsByDateRange(businessDate, businessDate);
  const viewCheckins = viewCheckinsInputFromCheckins(checkins);

  const result = calculateDailySummary(summaries, viewCheckins);
  if (!isCompleteDailySummary(result)) {
    throw new HttpError(409, 'MISSING_SHIFT_SUMMARIES', {
      message: formatMissingShiftSummariesError(result.businessDate, result.missingShifts),
      businessDate: result.businessDate,
      missingShifts: result.missingShifts,
    });
  }

  await saveDailySummary(result);
  logInfo('dailySummaries.generate.complete', {
    businessDate,
    totalRevenue: result.totalRevenue,
    totalCars: result.totalCars,
    roomsTurnedOver: result.roomsTurnedOver,
    checkinCount: result.checkinCount,
    elapsedMs: Date.now() - started,
  });
  return { ...result, generatedAt: new Date() };
}
