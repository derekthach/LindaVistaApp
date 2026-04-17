import type { CheckIn } from '@/types';
import { isGuestEmployeeUsername } from '@/lib/auth/guestEmployee';

/** Fields used to tell if the row was created while logged in as the shared `guest` account. */
export type GuestOriginCheckinFields = Pick<
  CheckIn,
  'employee_id' | 'created_by_role' | 'created_by_username'
>;

export function isCheckinCreatedByGuestAccount(checkin: GuestOriginCheckinFields): boolean {
  if (checkin.created_by_role !== 'employee') return false;
  if (isGuestEmployeeUsername(checkin.employee_id)) return true;
  if (isGuestEmployeeUsername(checkin.created_by_username)) return true;
  return false;
}

type StaffColumnCheckin = Pick<
  CheckIn,
  'staff_name' | 'employee_id' | 'created_by_role' | 'created_by_username'
>;

/**
 * Staff column / check-in staff line. Does not alter stored `staff_name`.
 */
export function formatStaffDisplayForCheckinsTable(checkin: StaffColumnCheckin): string {
  const name = (checkin.staff_name ?? '').trim();
  if (!isCheckinCreatedByGuestAccount(checkin)) {
    return name;
  }
  if (!name) return '(Guest)';
  return `${name} (Guest)`;
}

type GuestAwarePersonCheckin = Pick<
  CheckIn,
  'staff_name' | 'checked_out_by' | 'cleaned_by' | 'employee_id' | 'created_by_role' | 'created_by_username'
>;

/**
 * For checkout / edit-history names on a guest-origin row: add "(Guest)" when the string is
 * clearly the substitute’s typed name (matches check-in staff or checkout fields), or the
 * literal login name `guest`. Avoids tagging unrelated admin names on the same row.
 */
export function formatGuestAwarePersonDisplay(raw: string | undefined, checkin: GuestAwarePersonCheckin): string {
  const v = (raw ?? '').trim();
  if (!isCheckinCreatedByGuestAccount(checkin)) {
    return v || '—';
  }
  if (!v) return '(Guest)';
  const lower = v.toLowerCase();
  if (lower === 'guest') return `${v} (Guest)`;
  const staff = (checkin.staff_name ?? '').trim().toLowerCase();
  const out = (checkin.checked_out_by ?? '').trim().toLowerCase();
  const clean = (checkin.cleaned_by ?? '').trim().toLowerCase();
  if (staff && (lower === staff || lower === out || lower === clean)) {
    return `${v} (Guest)`;
  }
  return v;
}
