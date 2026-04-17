/** Shared fallback employee login (substitute workers). Case-insensitive on username. */
export const GUEST_EMPLOYEE_USERNAME = 'guest';

export function isGuestEmployeeUsername(username: string | undefined | null): boolean {
  return (username ?? '').trim().toLowerCase() === GUEST_EMPLOYEE_USERNAME;
}
