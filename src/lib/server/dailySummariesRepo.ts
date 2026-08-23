import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { HttpError } from '@/lib/server/httpError';
import { logInfo } from '@/lib/server/log';
import { getPersistedShiftSummariesForBusinessDate } from '@/lib/server/shiftSummariesRepo';
import {
  calculateDailySummary,
  dailySummaryDocId,
  formatMissingShiftSummariesError,
  isCompleteDailySummary,
  type DailySummary,
} from '@/lib/shifts';

const DAILY_SUMMARIES_COLLECTION = 'dailySummaries';

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
        totalCars: summary.totalCars,
        roomsTurnedOver: summary.roomsTurnedOver,
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
  return {
    businessDate: String(data.businessDate ?? businessDate),
    totalRevenue: Number(data.totalRevenue) || 0,
    totalCars: Number(data.totalCars) || 0,
    roomsTurnedOver: Number(data.roomsTurnedOver) || 0,
    timezone: 'America/Puerto_Rico',
    status: 'complete',
    shiftSummaryIds,
    ...(generatedAt ? { generatedAt } : {}),
  };
}

/**
 * Prefer reading the three persisted Shift Summary docs — does not reread `/checkins`.
 * Fails explicitly when any Shift Summary document is missing.
 */
export async function generateAndSaveDailySummaryForBusinessDate(
  businessDate: string
): Promise<DailySummary> {
  const started = Date.now();
  const { summaries, missingShifts } = await getPersistedShiftSummariesForBusinessDate(businessDate);

  if (missingShifts.length > 0) {
    throw new HttpError(409, 'MISSING_SHIFT_SUMMARIES', {
      message: formatMissingShiftSummariesError(businessDate, missingShifts),
      businessDate,
      missingShifts,
    });
  }

  const result = calculateDailySummary(summaries);
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
    elapsedMs: Date.now() - started,
  });
  return { ...result, generatedAt: new Date() };
}
