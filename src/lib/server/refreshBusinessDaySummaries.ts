/**
 * After check-in mutations, refresh persisted shift + daily summaries for affected
 * Puerto Rico business date(s) so multi-day overview stays accurate.
 */

import { generateCompletedBusinessDay } from '@/lib/server/completedBusinessDay';
import { logError, logInfo } from '@/lib/server/log';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function refreshBusinessDaySummaries(
  ...businessDates: Array<string | null | undefined>
): Promise<void> {
  const unique = [...new Set(businessDates.filter((d): d is string => Boolean(d && ISO_DATE.test(d))))];
  for (const businessDate of unique) {
    try {
      await generateCompletedBusinessDay(businessDate);
      logInfo('summaries.refresh.complete', { businessDate });
    } catch (err) {
      logError('summaries.refresh.error', {
        businessDate,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
