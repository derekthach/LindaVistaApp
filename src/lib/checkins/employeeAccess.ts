import { DateTime } from 'luxon';

/** Rolling window for employee recent-entry view and self-edit eligibility. */
export const EMPLOYEE_ENTRY_ACCESS_HOURS = 10;

const ZONE = 'America/Puerto_Rico';

/**
 * Cutoff instant (ms) for the employee access window in Puerto Rico local time.
 * Records with event time >= cutoff remain visible/editable.
 */
export function employeeAccessCutoffMs(
  now: DateTime = DateTime.now().setZone(ZONE),
  hours: number = EMPLOYEE_ENTRY_ACCESS_HOURS
): number {
  return now.setZone(ZONE).minus({ hours }).toMillis();
}

/**
 * Inclusive at the exact boundary (`eventMs >= cutoff`): an entry aged exactly
 * `hours` remains allowed; just after that it is blocked.
 */
export function isWithinEmployeeAccessWindow(
  eventMs: number,
  now: DateTime = DateTime.now().setZone(ZONE),
  hours: number = EMPLOYEE_ENTRY_ACCESS_HOURS
): boolean {
  if (!Number.isFinite(eventMs) || eventMs <= 0) return false;
  return eventMs >= employeeAccessCutoffMs(now, hours);
}
