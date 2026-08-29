import { DateTime } from 'luxon';
import { SHIFT_TIMEZONE } from '@/lib/shifts/definitions';

/**
 * Previous Puerto Rico calendar date (YYYY-MM-DD).
 * Used by the once-daily 9:00 AM PR Cron: at Aug 24 9:00 AM PR → businessDate 2026-08-23.
 */
export function getPreviousPuertoRicoBusinessDate(now: DateTime = DateTime.now()): string {
  const pr = now.setZone(SHIFT_TIMEZONE);
  if (!pr.isValid) {
    throw new Error('Invalid timestamp for previous Puerto Rico business date');
  }
  const businessDate = pr.minus({ days: 1 }).toISODate();
  if (!businessDate) {
    throw new Error('Could not resolve previous Puerto Rico business date');
  }
  return businessDate;
}

export function isShiftId(value: string): value is 'overnight' | 'day' | 'evening' {
  return value === 'overnight' || value === 'day' || value === 'evening';
}
