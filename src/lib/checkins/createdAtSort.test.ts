import { describe, expect, it } from 'vitest';
import { compareCheckinsByCreatedAtDesc, getCheckinCreationTimeMs } from './createdAtSort';

function ts(ms: number) {
  return {
    toMillis: () => ms,
    toDate: () => new Date(ms),
  };
}

describe('getCheckinCreationTimeMs', () => {
  it('uses createdAt when present, not checkInAt', () => {
    const created = Date.parse('2026-08-15T18:00:00.000Z');
    const checkIn = Date.parse('2026-07-30T14:00:00.000Z');
    expect(
      getCheckinCreationTimeMs({
        createdAt: ts(created),
        checkInAt: ts(checkIn),
      })
    ).toBe(created);
  });

  it('falls back to checkInAt for legacy docs without createdAt', () => {
    const checkIn = Date.parse('2026-07-30T14:00:00.000Z');
    expect(getCheckinCreationTimeMs({ checkInAt: ts(checkIn) })).toBe(checkIn);
  });
});

describe('compareCheckinsByCreatedAtDesc', () => {
  it('puts a newly entered historical record ahead of an older live same-day check-in', () => {
    const pastEntry = {
      createdAt: ts(Date.parse('2026-08-15T20:00:00.000Z')),
      checkInAt: ts(Date.parse('2026-07-30T10:00:00.000Z')),
      checkInType: 'room',
    };
    const liveToday = {
      createdAt: ts(Date.parse('2026-08-15T12:00:00.000Z')),
      checkInAt: ts(Date.parse('2026-08-15T12:00:00.000Z')),
      checkInType: 'food',
    };
    const olderLive = {
      createdAt: ts(Date.parse('2026-08-14T09:00:00.000Z')),
      checkInAt: ts(Date.parse('2026-08-14T09:00:00.000Z')),
      checkInType: 'beer',
    };

    const sorted = [olderLive, liveToday, pastEntry].sort(compareCheckinsByCreatedAtDesc);
    expect(sorted[0]).toBe(pastEntry);
    expect(sorted[1]).toBe(liveToday);
    expect(sorted[2]).toBe(olderLive);
  });

  it('does not order solely by check-in business date', () => {
    const enteredTodayDatedJuly = {
      createdAt: ts(Date.parse('2026-08-15T21:00:00.000Z')),
      checkInAt: ts(Date.parse('2026-07-30T08:00:00.000Z')),
    };
    const enteredEarlierDatedAugust = {
      createdAt: ts(Date.parse('2026-08-01T08:00:00.000Z')),
      checkInAt: ts(Date.parse('2026-08-14T18:00:00.000Z')),
    };
    const sorted = [enteredEarlierDatedAugust, enteredTodayDatedJuly].sort(
      compareCheckinsByCreatedAtDesc
    );
    expect(sorted[0]).toBe(enteredTodayDatedJuly);
  });
});
