import { describe, expect, it } from 'vitest';
import {
  formatDailyManagementMessage,
  formatTurnoverCountLabel,
  getShiftManagementMessageHeader,
} from './formatDailyManagementMessage';
import type { DailySummary } from './dailyTypes';
import type { ShiftSummary } from './types';

function shift(
  id: ShiftSummary['shift'],
  revenue: number,
  cars: number,
  turnovers: number,
  businessDate = '2026-08-23'
): ShiftSummary {
  return {
    businessDate,
    shift: id,
    shiftStart: new Date('2026-08-23T04:00:00.000Z'),
    shiftEnd: new Date('2026-08-23T12:00:00.000Z'),
    totalRevenue: revenue,
    totalCars: cars,
    roomsTurnedOver: turnovers,
    timezone: 'America/Puerto_Rico',
  };
}

describe('formatTurnoverCountLabel', () => {
  it('uses singular for 1 and plural otherwise', () => {
    expect(formatTurnoverCountLabel(0)).toBe('0 turnovers');
    expect(formatTurnoverCountLabel(1)).toBe('1 turnover');
    expect(formatTurnoverCountLabel(2)).toBe('2 turnovers');
    expect(formatTurnoverCountLabel(23)).toBe('23 turnovers');
  });
});

describe('getShiftManagementMessageHeader', () => {
  it('uses emoji + explicit shift-hour labels', () => {
    expect(getShiftManagementMessageHeader('overnight')).toBe('🌙 12:00 AM – 8:00 AM');
    expect(getShiftManagementMessageHeader('day')).toBe('☀️ 8:00 AM – 4:00 PM');
    expect(getShiftManagementMessageHeader('evening')).toBe('🌆 4:00 PM – 12:00 AM');
  });
});

describe('formatDailyManagementMessage', () => {
  const daily: DailySummary = {
    businessDate: '2026-08-23',
    totalRevenue: 1041,
    totalCars: 22,
    roomsTurnedOver: 24,
    timezone: 'America/Puerto_Rico',
    status: 'complete',
    shiftSummaryIds: {
      overnight: '2026-08-23_overnight',
      day: '2026-08-23_day',
      evening: '2026-08-23_evening',
    },
  };

  it('matches the management iMessage visual structure (plain text, no Markdown)', () => {
    const message = formatDailyManagementMessage(daily, [
      shift('evening', 0, 0, 1),
      shift('overnight', 863, 18, 0),
      shift('day', 178, 4, 23),
    ]);

    expect(message).toBe(
      [
        '🏨 Linda Vista — Daily Summary',
        '📅 August 23, 2026',
        '',
        '💰 Revenue: $1,041',
        '🚗 Cars: 22',
        '🧹 Rooms Turned Over: 24',
        '',
        '━━━━━━━━━━━━━━',
        '',
        '🌙 12:00 AM – 8:00 AM',
        '💵 $863 revenue',
        '🚗 18 cars',
        '🧹 0 turnovers',
        '',
        '☀️ 8:00 AM – 4:00 PM',
        '💵 $178 revenue',
        '🚗 4 cars',
        '🧹 23 turnovers',
        '',
        '🌆 4:00 PM – 12:00 AM',
        '💵 $0 revenue',
        '🚗 0 cars',
        '🧹 1 turnover',
      ].join('\n')
    );
  });

  it('formats currency with commas and formats the PR business date', () => {
    const message = formatDailyManagementMessage(
      { ...daily, totalRevenue: 12500, businessDate: '2026-08-23' },
      [shift('overnight', 0, 0, 0), shift('day', 0, 0, 0), shift('evening', 0, 0, 0)]
    );
    expect(message).toContain('📅 August 23, 2026');
    expect(message).toContain('💰 Revenue: $12,500');
  });

  it('uses overnight/day/evening emojis and never exposes internal shift ids', () => {
    const message = formatDailyManagementMessage(daily, [
      shift('overnight', 1, 1, 1),
      shift('day', 2, 2, 2),
      shift('evening', 3, 3, 3),
    ]);
    expect(message).toContain('🌙 12:00 AM – 8:00 AM');
    expect(message).toContain('☀️ 8:00 AM – 4:00 PM');
    expect(message).toContain('🌆 4:00 PM – 12:00 AM');
    expect(message).toContain('━━━━━━━━━━━━━━');
    expect(message).not.toContain('**');
    expect(message.toLowerCase()).not.toContain('overnight');
    expect(message.toLowerCase()).not.toMatch(/\bday\b/);
    expect(message.toLowerCase()).not.toContain('evening');
  });

  it('uses persisted daily numbers even if shift rows would sum differently', () => {
    const message = formatDailyManagementMessage(
      { ...daily, totalRevenue: 999, totalCars: 7, roomsTurnedOver: 3 },
      [shift('overnight', 0, 0, 0), shift('day', 0, 0, 0), shift('evening', 0, 0, 0)]
    );
    expect(message).toContain('💰 Revenue: $999');
    expect(message).toContain('🚗 Cars: 7');
    expect(message).toContain('🧹 Rooms Turned Over: 3');
  });
});
