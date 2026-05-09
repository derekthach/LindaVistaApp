import { DateTime } from 'luxon';

const ZONE = 'America/Puerto_Rico';

export function formatTime(timestamp: any): string {
  if (!timestamp) return '';

  try {
    if (typeof timestamp === 'string') {
      const raw = timestamp.trim();
      if (/^\d{2}:\d{2}$/.test(raw)) {
        const dt = DateTime.fromFormat(raw, 'HH:mm', { zone: ZONE });
        return dt.isValid ? dt.toFormat('h:mm a') : '';
      }
    }

    const date =
      typeof timestamp?.toDate === 'function'
        ? timestamp.toDate()
        : timestamp instanceof Date
          ? timestamp
          : new Date(timestamp);

    const dt = DateTime.fromJSDate(date).setZone(ZONE);
    if (!dt.isValid) return '';
    return dt.toFormat('h:mm a');
  } catch (e) {
    console.error('Time formatting error:', e);
    return '';
  }
}
