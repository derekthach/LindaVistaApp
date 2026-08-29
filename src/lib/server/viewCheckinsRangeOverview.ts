/**
 * Multi-day View Check-ins overview from persisted dailySummaries (not raw check-ins).
 * Regenerates a business day when the View Check-ins breakdown fields are missing.
 */

import { enumerateInclusiveBusinessDates } from '@/lib/checkins/dateRangeFilter';
import { sumSectionTotals, type SectionTotals } from '@/lib/checkins/sectioning';
import { getPersistedDailySummaryForViewCheckins } from '@/lib/server/dailySummariesRepo';
import { generateCompletedBusinessDay } from '@/lib/server/completedBusinessDay';
import { logInfo } from '@/lib/server/log';
import type { DailySummary } from '@/lib/shifts';

export type ViewCheckinsDayOverview = {
  businessDate: string;
  checkinCount: number;
  empty: boolean;
  dayTotals: SectionTotals;
  sectionTotals: [SectionTotals, SectionTotals, SectionTotals];
};

export type ViewCheckinsRangeOverview = {
  startISO: string;
  endISO: string;
  days: ViewCheckinsDayOverview[];
  rangeTotals: SectionTotals;
};

function dayOverviewFromDaily(summary: DailySummary): ViewCheckinsDayOverview {
  return {
    businessDate: summary.businessDate,
    checkinCount: summary.checkinCount,
    empty: summary.checkinCount === 0,
    dayTotals: summary.viewCheckinsDayTotals,
    sectionTotals: summary.viewCheckinsSections,
  };
}

/**
 * Ensure a persisted daily summary with View Check-ins breakdown exists for `businessDate`.
 * Uses a document get first; regenerates (one day check-in read) only when missing/stale schema.
 */
export async function ensureDailySummaryForViewCheckins(
  businessDate: string
): Promise<DailySummary> {
  const existing = await getPersistedDailySummaryForViewCheckins(businessDate);
  if (existing) return existing;
  const { dailySummary } = await generateCompletedBusinessDay(businessDate);
  return dailySummary;
}

export async function loadViewCheckinsRangeOverview(
  startISO: string,
  endISO: string
): Promise<ViewCheckinsRangeOverview> {
  const dates = enumerateInclusiveBusinessDates(startISO, endISO);
  const days: ViewCheckinsDayOverview[] = [];
  let regenerated = 0;

  for (const businessDate of dates) {
    const before = await getPersistedDailySummaryForViewCheckins(businessDate);
    const summary = before ?? (await generateCompletedBusinessDay(businessDate)).dailySummary;
    if (!before) regenerated += 1;
    days.push(dayOverviewFromDaily(summary));
  }

  const rangeTotals = sumSectionTotals(days.map((d) => d.dayTotals));

  logInfo('checkins.rangeOverview.complete', {
    startISO,
    endISO,
    dayCount: days.length,
    regeneratedDays: regenerated,
    rangeCars: rangeTotals.carCount,
    rangeTotalCents: rangeTotals.totalCents,
  });

  return { startISO, endISO, days, rangeTotals };
}
