import { describe, expect, it } from 'vitest';
import {
  VIEW_CHECKINS_MAX_RANGE_DAYS,
  enumerateInclusiveBusinessDates,
  inclusiveCalendarDayCount,
  validateViewCheckinsDateRange,
} from './dateRangeFilter';

describe('inclusiveCalendarDayCount', () => {
  it('counts one day when start equals end', () => {
    expect(inclusiveCalendarDayCount('2026-08-29', '2026-08-29')).toBe(1);
  });

  it('counts seven inclusive calendar days', () => {
    expect(inclusiveCalendarDayCount('2026-08-23', '2026-08-29')).toBe(7);
  });

  it('counts eight inclusive calendar days', () => {
    expect(inclusiveCalendarDayCount('2026-08-22', '2026-08-29')).toBe(8);
  });
});

describe('enumerateInclusiveBusinessDates', () => {
  it('lists ascending ISO dates inclusive', () => {
    expect(enumerateInclusiveBusinessDates('2026-08-20', '2026-08-22')).toEqual([
      '2026-08-20',
      '2026-08-21',
      '2026-08-22',
    ]);
  });
});

describe('validateViewCheckinsDateRange', () => {
  const today = '2026-08-29';

  it('accepts a single day', () => {
    expect(validateViewCheckinsDateRange('2026-08-20', '2026-08-20', today)).toEqual({
      ok: true,
      startISO: '2026-08-20',
      endISO: '2026-08-20',
      dayCount: 1,
    });
  });

  it('accepts exactly seven days', () => {
    const result = validateViewCheckinsDateRange('2026-08-20', '2026-08-26', today);
    expect(result).toEqual({
      ok: true,
      startISO: '2026-08-20',
      endISO: '2026-08-26',
      dayCount: VIEW_CHECKINS_MAX_RANGE_DAYS,
    });
  });

  it('rejects eight days', () => {
    expect(validateViewCheckinsDateRange('2026-08-20', '2026-08-27', today)).toEqual({
      ok: false,
      code: 'range_exceeds_max',
    });
  });

  it('rejects end before start', () => {
    expect(validateViewCheckinsDateRange('2026-08-25', '2026-08-20', today)).toEqual({
      ok: false,
      code: 'end_before_start',
    });
  });

  it('rejects future dates relative to PR today', () => {
    expect(validateViewCheckinsDateRange('2026-08-29', '2026-08-30', today)).toEqual({
      ok: false,
      code: 'future_date',
    });
    expect(validateViewCheckinsDateRange('2026-08-30', '2026-08-30', today)).toEqual({
      ok: false,
      code: 'future_date',
    });
  });

  it('accepts today as the maximum', () => {
    expect(validateViewCheckinsDateRange(today, today, today).ok).toBe(true);
  });
});
