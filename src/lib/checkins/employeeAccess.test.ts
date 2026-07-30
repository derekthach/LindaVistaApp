import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import {
  EMPLOYEE_ENTRY_ACCESS_HOURS,
  employeeAccessCutoffMs,
  isWithinEmployeeAccessWindow,
} from './employeeAccess';

const ZONE = 'America/Puerto_Rico';

describe('EMPLOYEE_ENTRY_ACCESS_HOURS', () => {
  it('is 10 hours for employee view and edit', () => {
    expect(EMPLOYEE_ENTRY_ACCESS_HOURS).toBe(10);
  });
});

describe('isWithinEmployeeAccessWindow', () => {
  const now = DateTime.fromObject(
    { year: 2026, month: 7, day: 26, hour: 2, minute: 0, second: 0 },
    { zone: ZONE }
  );

  it('allows an entry 9 hours after submission', () => {
    const eventMs = now.minus({ hours: 9 }).toMillis();
    expect(isWithinEmployeeAccessWindow(eventMs, now)).toBe(true);
  });

  it('allows an entry at exactly 10 hours (inclusive boundary)', () => {
    const eventMs = now.minus({ hours: 10 }).toMillis();
    expect(eventMs).toBe(employeeAccessCutoffMs(now));
    expect(isWithinEmployeeAccessWindow(eventMs, now)).toBe(true);
  });

  it('blocks an entry just after the 10-hour window', () => {
    const eventMs = now.minus({ hours: 10, milliseconds: 1 }).toMillis();
    expect(isWithinEmployeeAccessWindow(eventMs, now)).toBe(false);
  });

  it('allows a 4:00 PM entry through the 2:00 AM cutoff 10 hours later', () => {
    const entry = DateTime.fromObject(
      { year: 2026, month: 7, day: 25, hour: 16, minute: 0, second: 0 },
      { zone: ZONE }
    );
    const atCutoff = entry.plus({ hours: 10 });
    expect(isWithinEmployeeAccessWindow(entry.toMillis(), atCutoff)).toBe(true);
    expect(
      isWithinEmployeeAccessWindow(entry.toMillis(), atCutoff.plus({ milliseconds: 1 }))
    ).toBe(false);
  });
});
