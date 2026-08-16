import { describe, expect, it } from 'vitest';
import { resolveViewCheckinsQuery, VIEW_CHECKINS_ALL_HREF, wantsAllCheckins } from './viewCheckinsQuery';

describe('wantsAllCheckins', () => {
  it('accepts explicit all flags', () => {
    expect(wantsAllCheckins({ all: '1' })).toBe(true);
    expect(wantsAllCheckins({ all: 'true' })).toBe(true);
    expect(wantsAllCheckins({ all: 'YES' })).toBe(true);
    expect(wantsAllCheckins({})).toBe(false);
    expect(wantsAllCheckins({ all: '0' })).toBe(false);
  });
});

describe('resolveViewCheckinsQuery', () => {
  const today = '2026-08-14';

  it('defaults bare /checkins to today (PR) in-place without redirect', () => {
    expect(resolveViewCheckinsQuery({}, today)).toEqual({
      kind: 'day',
      dateISO: today,
      startISO: today,
      endISO: today,
    });
  });

  it('preserves a selected calendar day', () => {
    expect(resolveViewCheckinsQuery({ date: '2026-07-01' }, today)).toEqual({
      kind: 'day',
      dateISO: '2026-07-01',
      startISO: '2026-07-01',
      endISO: '2026-07-01',
    });
  });

  it('preserves start/end range', () => {
    expect(
      resolveViewCheckinsQuery({ start_date: '2026-07-01', end_date: '2026-07-07' }, today)
    ).toEqual({
      kind: 'range',
      startISO: '2026-07-01',
      endISO: '2026-07-07',
    });
  });

  it('allows explicit all=1 history (not the default)', () => {
    expect(resolveViewCheckinsQuery({ all: '1' }, today)).toEqual({ kind: 'all' });
  });

  it('prefers an explicit date over all=1', () => {
    expect(resolveViewCheckinsQuery({ all: '1', date: '2026-07-01' }, today)).toEqual({
      kind: 'day',
      dateISO: '2026-07-01',
      startISO: '2026-07-01',
      endISO: '2026-07-01',
    });
  });

  it('treats all=1 with no date as unfiltered newest-created mode', () => {
    expect(VIEW_CHECKINS_ALL_HREF).toBe('/checkins?all=1');
    expect(resolveViewCheckinsQuery({ all: '1' }, today)).toEqual({ kind: 'all' });
    expect(resolveViewCheckinsQuery({ all: '1', date: '' }, today)).toEqual({ kind: 'all' });
  });
});
