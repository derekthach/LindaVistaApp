import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { resolveCompletedShiftCronTarget, SHIFT_TIMEZONE } from '@/lib/shifts';
import { requireCronAuthorization } from '@/lib/server/cronAuth';
import { HttpError } from '@/lib/server/httpError';
import { getShiftWindow, getShiftIdForTimeHHmm } from '@/lib/shifts';

describe('resolveCompletedShiftCronTarget', () => {
  it('Overnight at 8:01 AM PR → same calendar businessDate overnight', () => {
    const now = DateTime.fromObject(
      { year: 2026, month: 8, day: 23, hour: 8, minute: 1 },
      { zone: SHIFT_TIMEZONE }
    );
    expect(resolveCompletedShiftCronTarget('overnight', now)).toEqual({
      businessDate: '2026-08-23',
      shift: 'overnight',
    });
  });

  it('Day at 4:01 PM PR → same calendar businessDate day', () => {
    const now = DateTime.fromObject(
      { year: 2026, month: 8, day: 23, hour: 16, minute: 1 },
      { zone: SHIFT_TIMEZONE }
    );
    expect(resolveCompletedShiftCronTarget('day', now)).toEqual({
      businessDate: '2026-08-23',
      shift: 'day',
    });
  });

  it('Evening at 12:01 AM PR → PREVIOUS calendar day evening', () => {
    const now = DateTime.fromObject(
      { year: 2026, month: 8, day: 24, hour: 0, minute: 1 },
      { zone: SHIFT_TIMEZONE }
    );
    expect(resolveCompletedShiftCronTarget('evening', now)).toEqual({
      businessDate: '2026-08-23',
      shift: 'evening',
    });
  });

  it('does not use UTC calendar date for evening (UTC may still be prior evening)', () => {
    // 12:01 AM Aug 24 PR = 4:01 AM Aug 24 UTC
    const now = DateTime.fromISO('2026-08-24T04:01:00.000Z');
    expect(resolveCompletedShiftCronTarget('evening', now).businessDate).toBe('2026-08-23');
  });
});

describe('requireCronAuthorization', () => {
  it('returns 401 when CRON_SECRET is unset', () => {
    const prev = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      expect(() =>
        requireCronAuthorization(new Request('https://example.com', { headers: { authorization: 'Bearer x' } }))
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

describe('Cron buffer does not change reporting windows', () => {
  it('shift windows remain half-open at 8:00 and 16:00', () => {
    const overnight = getShiftWindow('2026-08-23', 'overnight');
    const day = getShiftWindow('2026-08-23', 'day');
    const evening = getShiftWindow('2026-08-23', 'evening');

    expect(getShiftIdForTimeHHmm('07:59')).toBe('overnight');
    expect(getShiftIdForTimeHHmm('08:00')).toBe('day');
    expect(getShiftIdForTimeHHmm('15:59')).toBe('day');
    expect(getShiftIdForTimeHHmm('16:00')).toBe('evening');

    // Cron runs at :01 — reporting end is still exactly 08:00 / 16:00 / next midnight
    expect(overnight.shiftEnd.getTime()).toBe(day.shiftStart.getTime());
    expect(day.shiftEnd.getTime()).toBe(evening.shiftStart.getTime());
  });
});

describe('getShiftDisplayLabel', () => {
  it('returns operating hours, not Overnight/Day/Evening names', async () => {
    const { getShiftDisplayLabel, getShiftDisplayTitle } = await import('./definitions');
    expect(getShiftDisplayLabel('overnight')).toBe('12:00 AM – 8:00 AM');
    expect(getShiftDisplayLabel('day')).toBe('8:00 AM – 4:00 PM');
    expect(getShiftDisplayLabel('evening')).toBe('4:00 PM – 12:00 AM');
    expect(getShiftDisplayTitle('day')).toBe('8:00 AM – 4:00 PM Shift');
  });
});
