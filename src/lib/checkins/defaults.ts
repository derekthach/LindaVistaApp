import { DateTime } from 'luxon';

const ZONE = 'America/Puerto_Rico';

/** Current date (YYYY-MM-DD) and time (HH:mm) in America/Puerto_Rico */
export function getDefaultDateAndTime(): { date: string; time: string } {
  const now = DateTime.now().setZone(ZONE);
  return {
    date: now.toISODate() ?? '',
    time: now.toFormat('HH:mm'),
  };
}
