/**
 * Validate Daily Summary = sum of three Shift Summaries for historical PR dates.
 * Usage: npx tsx --env-file=.env.local scripts/validate-daily-summaries.ts
 * Optional: YYYY-MM-DD YYYY-MM-DD YYYY-MM-DD
 * Does not write to Firestore.
 */
import { DateTime } from 'luxon';
import { listCheckinsByDateRange } from '../src/lib/server/checkinsRepo';
import { listRoomTurnoversForBusinessDate } from '../src/lib/server/shiftSummariesRepo';
import {
  calculateDailySummary,
  calculateDayShiftSummaries,
  isCompleteDailySummary,
  sumShiftMetrics,
} from '../src/lib/shifts';
import { buildSectionedData } from '../src/lib/checkins/sectioning';

const ZONE = 'America/Puerto_Rico';

async function validateDate(businessDate: string) {
  const [checkins, turnovers] = await Promise.all([
    listCheckinsByDateRange(businessDate, businessDate),
    listRoomTurnoversForBusinessDate(businessDate),
  ]);
  const shifts = calculateDayShiftSummaries(businessDate, checkins, turnovers);
  const sectioned = buildSectionedData(checkins);
  const daily = calculateDailySummary(shifts, {
    checkinCount: checkins.length,
    viewCheckinsSections: [
      sectioned.sectionTotals[0]!,
      sectioned.sectionTotals[1]!,
      sectioned.sectionTotals[2]!,
    ],
    viewCheckinsDayTotals: sectioned.dayTotals,
  });
  const summed = sumShiftMetrics(shifts);

  console.log(`\n=== ${businessDate} ===`);
  for (const s of shifts) {
    console.log(
      `  ${s.shift.padEnd(10)} revenue=$${s.totalRevenue.toFixed(2)} cars=${s.totalCars} rooms=${s.roomsTurnedOver}`
    );
  }

  if (!isCompleteDailySummary(daily)) {
    console.log('  Daily: INCOMPLETE', daily.missingShifts.join(', '));
    return { businessDate, ok: false };
  }

  const revenueOk = Math.abs(daily.totalRevenue - summed.totalRevenue) < 0.001;
  const carsOk = daily.totalCars === summed.totalCars;
  const roomsOk = daily.roomsTurnedOver === summed.roomsTurnedOver;
  console.log(
    `  Daily      revenue=$${daily.totalRevenue.toFixed(2)} cars=${daily.totalCars} rooms=${daily.roomsTurnedOver}`
  );
  console.log(
    `  Aggregate match: revenue=${revenueOk ? 'OK' : 'FAIL'} cars=${carsOk ? 'OK' : 'FAIL'} rooms=${roomsOk ? 'OK' : 'FAIL'}`
  );
  return { businessDate, ok: revenueOk && carsOk && roomsOk };
}

async function main() {
  const today = DateTime.now().setZone(ZONE);
  const defaults = [
    today.minus({ days: 1 }).toISODate()!,
    today.minus({ days: 2 }).toISODate()!,
    today.minus({ days: 3 }).toISODate()!,
  ];
  const args = process.argv.slice(2).filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const toRun = args.length >= 3 ? args.slice(0, 3) : defaults;

  console.log('Validating daily summaries for:', toRun.join(', '));
  const results = [];
  for (const d of toRun) {
    results.push(await validateDate(d));
  }
  const allOk = results.every((r) => r.ok);
  console.log(allOk ? '\nAll dates OK' : '\nSome failures — see above');
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
