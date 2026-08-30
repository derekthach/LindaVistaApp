/**
 * Multi-day / filtered overview built from date-scoped check-ins + Advanced Filters.
 * Used when non-date filters are active (persisted dailySummaries are unfiltered).
 */

import { enumerateInclusiveBusinessDates } from '@/lib/checkins/dateRangeFilter';
import {
  applyAdvancedFilters,
  type AdvancedCheckinsFilters,
  hasActiveAdvancedFilters,
} from '@/lib/checkins/advancedFilters';
import { buildSectionedData, sumSectionTotals, type SectionTotals } from '@/lib/checkins/sectioning';
import { listCheckinsByDateRange } from '@/lib/server/checkinsRepo';
import type { ViewCheckinsDayOverview, ViewCheckinsRangeOverview } from '@/lib/server/viewCheckinsRangeOverview';
import type { CheckIn } from '@/types';
import { logInfo } from '@/lib/server/log';

function emptyTotals(): SectionTotals {
  return { roomCents: 0, foodCents: 0, beerCents: 0, totalCents: 0, carCount: 0 };
}

export async function loadFilteredViewCheckinsRangeOverview(
  startISO: string,
  endISO: string,
  filters: AdvancedCheckinsFilters
): Promise<ViewCheckinsRangeOverview & { filteredCheckins: CheckIn[] }> {
  const raw = await listCheckinsByDateRange(startISO, endISO);
  const filtered = hasActiveAdvancedFilters(filters)
    ? applyAdvancedFilters(raw, filters)
    : raw;

  const dates = enumerateInclusiveBusinessDates(startISO, endISO);
  const days: ViewCheckinsDayOverview[] = [];

  for (const businessDate of dates) {
    const dayCheckins = filtered.filter((c) => c.date === businessDate);
    if (dayCheckins.length === 0) {
      days.push({
        businessDate,
        checkinCount: 0,
        empty: true,
        dayTotals: emptyTotals(),
        sectionTotals: [emptyTotals(), emptyTotals(), emptyTotals()],
      });
      continue;
    }
    const sectioned = buildSectionedData(dayCheckins);
    days.push({
      businessDate,
      checkinCount: dayCheckins.length,
      empty: false,
      dayTotals: sectioned.dayTotals,
      sectionTotals: [
        sectioned.sectionTotals[0] ?? emptyTotals(),
        sectioned.sectionTotals[1] ?? emptyTotals(),
        sectioned.sectionTotals[2] ?? emptyTotals(),
      ],
    });
  }

  const rangeTotals = sumSectionTotals(days.map((d) => d.dayTotals));

  logInfo('checkins.filteredRangeOverview.complete', {
    startISO,
    endISO,
    rawCount: raw.length,
    filteredCount: filtered.length,
    dayCount: days.length,
    rangeCars: rangeTotals.carCount,
    rangeTotalCents: rangeTotals.totalCents,
  });

  return { startISO, endISO, days, rangeTotals, filteredCheckins: filtered };
}
