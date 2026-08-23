import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import {
  getPreviousPuertoRicoBusinessDate,
  getShiftDisplayLabel,
  getShiftDisplayTitle,
  getShiftIdForTimeHHmm,
  getShiftWindow,
  SHIFT_TIMEZONE,
} from '@/lib/shifts';
import { requireCronAuthorization } from '@/lib/server/cronAuth';
import { HttpError } from '@/lib/server/httpError';

describe('getPreviousPuertoRicoBusinessDate', () => {
  it('at Aug 24 6:00 AM PR → businessDate Aug 23', () => {
    const now = DateTime.fromObject(
      { year: 2026, month: 8, day: 24, hour: 6, minute: 0 },
      { zone: SHIFT_TIMEZONE }
    );
    expect(getPreviousPuertoRicoBusinessDate(now)).toBe('2026-08-23');
  });

  it('does not use UTC calendar date alone (10:00 UTC = 6:00 AM PR)', () => {
    const now = DateTime.fromISO('2026-08-24T10:00:00.000Z');
    expect(getPreviousPuertoRicoBusinessDate(now)).toBe('2026-08-23');
  });
});

describe('requireCronAuthorization', () => {
  it('returns 401 when CRON_SECRET is unset', () => {
    const prev = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      expect(() =>
        requireCronAuthorization(
          new Request('https://example.com', { headers: { authorization: 'Bearer x' } })
        )
      ).toThrow(HttpError);
    } finally {
      if (prev === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prev;
    }
  });

  it('returns 401 when Authorization is missing', () => {
    const prev = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'test-secret';
    try {
      expect(() => requireCronAuthorization(new Request('https://example.com'))).toThrow(HttpError);
    } finally {
      if (prev === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prev;
    }
  });

  it('returns 401 when token is wrong', () => {
    const prev = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'test-secret';
    try {
      expect(() =>
        requireCronAuthorization(
          new Request('https://example.com', { headers: { authorization: 'Bearer wrong' } })
        )
      ).toThrow(HttpError);
    } finally {
      if (prev === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prev;
    }
  });

  it('accepts Bearer CRON_SECRET', () => {
    const prev = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'test-secret';
    try {
      expect(() =>
        requireCronAuthorization(
          new Request('https://example.com', { headers: { authorization: 'Bearer test-secret' } })
        )
      ).not.toThrow();
    } finally {
      if (prev === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prev;
    }
  });
});

describe('half-open shift boundaries (unchanged by daily Cron)', () => {
  it('assigns boundary clock times to exactly one shift', () => {
    expect(getShiftIdForTimeHHmm('07:59')).toBe('overnight');
    expect(getShiftIdForTimeHHmm('08:00')).toBe('day');
    expect(getShiftIdForTimeHHmm('15:59')).toBe('day');
    expect(getShiftIdForTimeHHmm('16:00')).toBe('evening');
    expect(getShiftIdForTimeHHmm('23:59')).toBe('evening');
    expect(getShiftIdForTimeHHmm('00:00')).toBe('overnight');

    const overnight = getShiftWindow('2026-08-23', 'overnight');
    const day = getShiftWindow('2026-08-23', 'day');
    const evening = getShiftWindow('2026-08-23', 'evening');
    expect(overnight.shiftEnd.getTime()).toBe(day.shiftStart.getTime());
    expect(day.shiftEnd.getTime()).toBe(evening.shiftStart.getTime());
  });
});

describe('getShiftDisplayLabel', () => {
  it('returns operating hours, not Overnight/Day/Evening names', () => {
    expect(getShiftDisplayLabel('overnight')).toBe('12:00 AM – 8:00 AM');
    expect(getShiftDisplayLabel('day')).toBe('8:00 AM – 4:00 PM');
    expect(getShiftDisplayLabel('evening')).toBe('4:00 PM – 12:00 AM');
    expect(getShiftDisplayTitle('day')).toBe('8:00 AM – 4:00 PM Shift');
  });
});
