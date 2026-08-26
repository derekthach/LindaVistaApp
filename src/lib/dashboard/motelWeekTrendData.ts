import { DateTime } from 'luxon';
import type { CheckIn, DashboardData } from '@/types';
import { isRoomCheckinRecord } from '@/lib/checkins/roomCheckinRecord';
import { getEntryCount } from '@/lib/checkins/entryCount';
import { getMotelBusinessWeekStart } from '@/lib/dates/motelBusinessWeek';

const ZONE = 'America/Puerto_Rico';

/**
 * Seven X-axis points per motel week (Fri→Thu). Current series is week-to-date through `now`;
 * previous series is the full prior Fri–Thu week. Aligns with `get7DayTrends` / dashboard bundle.
 */
export function deriveMotelWeekTrendComparisonFromCheckins(
  checkins: CheckIn[],
  now: DateTime,
  zone: string = ZONE
): DashboardData {
  const todayISO = now.toISODate() ?? '';
  const currentWeekStart = getMotelBusinessWeekStart(now, zone);
  const prevWeekStart = currentWeekStart.minus({ days: 7 });

  const byIso = new Map<string, CheckIn[]>();
  for (const c of checkins) {
    const list = byIso.get(c.date) ?? [];
    list.push(c);
    byIso.set(c.date, list);
  }

  const dates: string[] = [];
  const trendAxisIsos: string[] = [];
  const checkinsCur: number[] = [];
  const revenueCur: number[] = [];
  const checkinsPrev: number[] = [];
  const revenuePrev: number[] = [];

  for (let i = 0; i < 7; i++) {
    const dayCur = currentWeekStart.plus({ days: i });
    const dayPrev = prevWeekStart.plus({ days: i });
    const isoCur = dayCur.toISODate() ?? '';
    const isoPrev = dayPrev.toISODate() ?? '';

    trendAxisIsos.push(isoCur);
    dates.push(dayCur.toFormat('MM/dd'));

    let pRoom = 0;
    let pRev = 0;
    for (const c of byIso.get(isoPrev) ?? []) {
      if (isRoomCheckinRecord(c)) pRoom += getEntryCount(c);
      pRev += c.cost;
    }
    checkinsPrev.push(pRoom);
    revenuePrev.push(pRev);

    let cRoom = 0;
    let cRev = 0;
    if (isoCur <= todayISO) {
      for (const c of byIso.get(isoCur) ?? []) {
        if (isRoomCheckinRecord(c)) cRoom += getEntryCount(c);
        cRev += c.cost;
      }
    }
    checkinsCur.push(cRoom);
    revenueCur.push(cRev);
  }

  return {
    dates,
    trendAxisIsos,
    checkins: checkinsCur,
    revenue: revenueCur,
    checkinsPrevWeek: checkinsPrev,
    revenuePrevWeek: revenuePrev,
  };
}
