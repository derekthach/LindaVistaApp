import { DateTime } from 'luxon';
import { SHIFT_TIMEZONE, type ShiftId } from '@/lib/shifts';

export type CompletedShiftCronTarget = {
  businessDate: string;
  shift: ShiftId;
};

/**
 * Resolve which Shift Summary the Cron should generate from Puerto Rico "now".
 *
 * Overnight Cron (~8:01 AM PR) → today's overnight
 * Day Cron (~4:01 PM PR) → today's day
 * Evening Cron (~12:01 AM PR) → PREVIOUS calendar day's evening
 */
export function resolveCompletedShiftCronTarget(
  shift: ShiftId,
  now: DateTime = DateTime.now()
): CompletedShiftCronTarget {
  const pr = now.setZone(SHIFT_TIMEZONE);
  if (!pr.isValid) {
    throw new Error('Invalid timestamp for cron target resolution');
  }

  if (shift === 'evening') {
    const businessDate = pr.minus({ days: 1 }).toISODate();
    if (!businessDate) throw new Error('Could not resolve evening businessDate');
    return { businessDate, shift: 'evening' };
  }

  const businessDate = pr.toISODate();
  if (!businessDate) throw new Error('Could not resolve businessDate');
  return { businessDate, shift };
}

export function isShiftId(value: string): value is ShiftId {
  return value === 'overnight' || value === 'day' || value === 'evening';
}
