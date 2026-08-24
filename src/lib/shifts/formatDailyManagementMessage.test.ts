import { describe, expect, it } from 'vitest';
import { formatDailyManagementMessage } from './formatDailyManagementMessage';
import type { DailySummary } from './dailyTypes';
import type { ShiftSummary } from './types';

function shift(
  id: ShiftSummary['shift'],
  revenue: number,
  cars: number,
  turnovers: number
): ShiftSummary {
  return {
    businessDate: '2026-08-22',
    shift: id,
    shiftStart: new Date('2026-08-22T04:00:00.000Z'),
    shiftEnd: new Date('2026-08-22T12:00:00.000Z'),
    totalRevenue: revenue,
    totalCars: cars,
    roomsTurnedOver: turnovers,
    timezone: 'America/Puerto_Rico',
  };
}

describe('formatDailyManagementMessage', () => {
  const daily: DailySummary = {
    businessDate: '2026-08-22',
    totalRevenue: 872,
    totalCars: 20,
    roomsTurnedOver: 20,
    timezone: 'America/Puerto_Rico',
    status: 'complete',
    shiftSummaryIds: {
      overnight: '2026-08-22_overnight',
      day: '2026-08-22_day',
      evening: '2026-08-22_evening',
    },
  };

  it('formats daily + explicit shift-hour lines without recalculating totals', () => {
    const message = formatDailyManagementMessage(daily, [
      shift('evening', 0, 0, 0),
      shift('overnight', 364, 9, 0),
      shift('day', 508, 11, 20),
    ]);

    expect(message).toBe(
      [
        'Linda Vista — August 22, 2026',
        '',
        'DAILY SUMMARY',
        'Revenue: $872',
        'Cars: 20',
        'Rooms Turned Over: 20',
        '',
        '12:00 AM – 8:00 AM',
        'Revenue: $364 · Cars: 9 · Turnovers: 0',
        '',
        '8:00 AM – 4:00 PM',
        'Revenue: $508 · Cars: 11 · Turnovers: 20',
        '',
        '4:00 PM – 12:00 AM',
        'Revenue: $0 · Cars: 0 · Turnovers: 0',
      ].join('\n')
    );
  });

  it('never exposes internal overnight/day/evening labels', () => {
    const message = formatDailyManagementMessage(daily, [
      shift('overnight', 1, 1, 1),
      shift('day', 2, 2, 2),
      shift('evening', 3, 3, 3),
    ]);
    expect(message.toLowerCase()).not.toContain('overnight');
    expect(message.toLowerCase()).not.toMatch(/\bday\b/);
    expect(message.toLowerCase()).not.toContain('evening');
  });

  it('uses persisted daily numbers even if shift rows would sum differently', () => {
    const message = formatDailyManagementMessage(
      { ...daily, totalRevenue: 999, totalCars: 7, roomsTurnedOver: 3 },
      [shift('overnight', 0, 0, 0), shift('day', 0, 0, 0), shift('evening', 0, 0, 0)]
    );
    expect(message).toContain('Revenue: $999');
    expect(message).toContain('Cars: 7');
    expect(message).toContain('Rooms Turned Over: 3');
  });
});
