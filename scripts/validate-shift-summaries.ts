/**
 * Validates Shift Summary revenue/cars against Day Summary for historical PR business dates.
 * Usage: npx tsx --env-file=.env.local scripts/validate-shift-summaries.ts
 * Optional args: YYYY-MM-DD YYYY-MM-DD YYYY-MM-DD
 * Does not write to Firestore.
 */
import { DateTime } from 'luxon';
import { listCheckinsByDateRange } from '../src/lib/server/checkinsRepo';
import { listRoomTurnoversForBusinessDate } from '../src/lib/server/shiftSummariesRepo';
import { calculateDayShiftSummaries, sumShiftMetrics } from '../src/lib/shifts';
import { totalsToCents } from '../src/lib/checkins/sectioning';

const ZONE = 'America/Puerto_Rico';

async function validateDate(businessDate: string) {
  const [checkins, turnovers] = await Promise.all([
    listCheckinsByDateRange(businessDate, businessDate),
    listRoomTurnoversForBusinessDate(businessDate),
  ]);
  const day = totalsToCents(checkins);
  const summaries = calculateDayShiftSummaries(businessDate, checkins, turnovers);
  const summed = sumShiftMetrics(summaries);
  const revenueMatch = Math.round(summed.totalRevenue * 100) === day.totalCents;
  const carsMatch = summed.totalCars === day.carCount;

  console.log(`\n=== ${businessDate} ===`);
  console.log(`Check-ins loaded: ${checkins.length}; turnovers loaded: ${turnovers.length}`);
  for (const s of summaries) {
    console.log(
      `  ${s.shift.padEnd(10)} revenue=$${s.totalRevenue.toFixed(2)} cars=${s.totalCars} roomsTurnedOver=${s.roomsTurnedOver}`
    );
  }
  console.log(
    `  DAY TOTAL   revenue=$${(day.totalCents / 100).toFixed(2)} cars=${day.carCount}`
  );
  console.log(
    `  SHIFT SUM  revenue=$${summed.totalRevenue.toFixed(2)} cars=${summed.totalCars} roomsTurnedOver=${summed.roomsTurnedOver}`
  );
  console.log(`  Revenue match: ${revenueMatch ? 'OK' : 'MISMATCH'}`);
  console.log(`  Cars match: ${carsMatch ? 'OK' : 'MISMATCH'}`);

  return { businessDate, revenueMatch, carsMatch };
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

  console.log('Validating shift summaries for:', toRun.join(', '));
  const results = [];
  for (const d of toRun) {
    results.push(await validateDate(d));
  }
  const allOk = results.every((r) => r.revenueMatch && r.carsMatch);
  console.log(allOk ? '\nAll dates OK' : '\nSome mismatches — see above');
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
