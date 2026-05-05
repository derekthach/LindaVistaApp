import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import {
  getMotelBusinessWeekRange,
  getMotelBusinessWeekStart,
  getMotelBusinessWeekStartIso,
  getPreviousMotelBusinessWeekRange,
  MOTEL_TIMEZONE,
} from './motelBusinessWeek';

function dt(isoLocalDate: string, hour = 12, minute = 0): DateTime {
  return DateTime.fromObject(
    {
      year: parseInt(isoLocalDate.slice(0, 4), 10),
      month: parseInt(isoLocalDate.slice(5, 7), 10),
      day: parseInt(isoLocalDate.slice(8, 10), 10),
      hour,
      minute,
      second: 0,
      millisecond: 0,
    },
    { zone: MOTEL_TIMEZONE }
  );
}

describe('getMotelBusinessWeekStart', () => {
  it('Friday 12:00 a.m. PR starts a new motel week (that calendar Friday)', () => {
    const fri = dt('2026-05-08', 0, 0);
    const start = getMotelBusinessWeekStart(fri);
    expect(start.toISODate()).toBe('2026-05-08');
    expect(start.hour).toBe(0);
  });

  it('Thursday 11:59 p.m. PR is still in the week that began prior Friday', () => {
    const thuLate = dt('2026-05-07', 23, 59);
    const start = getMotelBusinessWeekStart(thuLate);
    expect(start.toISODate()).toBe('2026-05-01');
  });

  it('Thursday → Friday midnight: just after midnight is the new week', () => {
    const friStart = dt('2026-05-08', 0, 0);
    const start = getMotelBusinessWeekStart(friStart);
    expect(start.toISODate()).toBe('2026-05-08');
  });

  it('getMotelBusinessWeekStartIso matches start .toISODate()', () => {
    const now = dt('2026-05-06', 15, 0);
    expect(getMotelBusinessWeekStartIso(now)).toBe(getMotelBusinessWeekStart(now).toISODate());
  });
});

describe('getMotelBusinessWeekRange', () => {
  it('end is Thursday 23:59:59.999 of the same Fri–Thu block', () => {
    const fri = dt('2026-05-08', 0, 0);
    const { start, end } = getMotelBusinessWeekRange(fri);
    expect(start.toISODate()).toBe('2026-05-08');
    expect(end.toISODate()).toBe('2026-05-14');
    expect(end.hour).toBe(23);
    expect(end.minute).toBe(59);
    expect(end.second).toBe(59);
  });
});

describe('getPreviousMotelBusinessWeekRange', () => {
  it('returns the prior Fri through prior Thu', () => {
    const wed = dt('2026-05-06', 10, 0);
    const { start, end } = getPreviousMotelBusinessWeekRange(wed);
    expect(start.toISODate()).toBe('2026-04-24');
    expect(end.toISODate()).toBe('2026-04-30');
  });
});
