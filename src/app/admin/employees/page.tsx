import { requireAuth } from '@/server/auth/session';
import AppLayout from '@/components/AppLayout';
import EmployeesAdminClient, { type EmployeeTableRow } from '@/components/EmployeesAdminClient';
import LocalizedPageHeading from '@/components/LocalizedPageHeading';
import { countPendingPasswordResets, listUsersPublic } from '@/lib/server/usersRepo';
import type { PublicUserRow } from '@/lib/server/usersRepo';

export const dynamic = 'force-dynamic';

function toTableRow(u: PublicUserRow): EmployeeTableRow {
  let lastLoginAt: string | null = null;
  try {
    if (u.lastLoginAt && typeof u.lastLoginAt.toDate === 'function') {
      lastLoginAt = u.lastLoginAt.toDate().toISOString();
    }
  } catch {
    lastLoginAt = null;
  }
  return {
    id: u.id,
    fullName: u.fullName,
    username: u.username,
    role: u.role,
    status: u.status,
    mustChangePassword: u.mustChangePassword === true,
    passwordResetRequested: u.passwordResetRequested === true,
    lastLoginAt,
    firestoreBacked: u.firestoreBacked === true,
  };
}

export default async function AdminEmployeesPage() {
  const session = await requireAuth('admin');
  const [users, pendingResetCount] = await Promise.all([listUsersPublic(), countPendingPasswordResets()]);

  return (
    <AppLayout
      role={session.role}
      employeeGreetingName={
        session.role === 'employee' ? (session.displayName ?? session.username) : undefined
      }
    >
      <div className="container">
        <LocalizedPageHeading titleKey="employees_title" subtitleKey="employees_subtitle" />
        <EmployeesAdminClient users={users.map(toTableRow)} pendingResetCount={pendingResetCount} />
      </div>
    </AppLayout>
  );
}
