/** Shared staff list for all check-in forms (room, food, beer). */
export const STAFF_MEMBERS = [
  'Benjamin (Siky)',
  'Luis',
  'Tonito',
  'Tono',
  'Jose (Ivan)',
  'Makito',
  'Keith Thach',
  'Duyen Thach',
  'Derek Thach',
] as const;

/** Names hidden from the staff dropdown when the user is an employee (non-admin). */
export const STAFF_HIDDEN_FOR_EMPLOYEE = ['Keith Thach', 'Duyen Thach'] as const;

/** Staff options to show: all for admin, filtered for employee. */
export function getStaffOptionsForRole(isAdmin: boolean): readonly string[] {
  if (isAdmin) return STAFF_MEMBERS;
  const hidden = new Set<string>(STAFF_HIDDEN_FOR_EMPLOYEE);
  return STAFF_MEMBERS.filter((s) => !hidden.has(s));
}
