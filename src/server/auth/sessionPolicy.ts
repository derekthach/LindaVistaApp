import type { UserRole } from '@/types';

export const EMPLOYEE_SESSION_MAX_MS = 4 * 60 * 60 * 1000;
export const ADMIN_SESSION_MAX_MS = 12 * 60 * 60 * 1000;
export const EMPLOYEE_INACTIVITY_MS = 30 * 60 * 1000;
export const ADMIN_INACTIVITY_MS = 45 * 60 * 1000;

export function sessionHardMsForRole(role: UserRole): number {
  return role === 'admin' ? ADMIN_SESSION_MAX_MS : EMPLOYEE_SESSION_MAX_MS;
}

export function inactivityMsForRole(role: UserRole): number {
  return role === 'admin' ? ADMIN_INACTIVITY_MS : EMPLOYEE_INACTIVITY_MS;
}

export function cookieMaxAgeSecForRole(role: UserRole): number {
  return Math.floor(sessionHardMsForRole(role) / 1000);
}
