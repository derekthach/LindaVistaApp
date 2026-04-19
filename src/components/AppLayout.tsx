import I18nAppShell from './I18nAppShell';
import type { UserRole } from '@/types';

export default function AppLayout({
  children,
  role,
  employeeGreetingName,
  employeeUsername,
}: {
  children: React.ReactNode;
  role: UserRole;
  /** Shown in sidebar as “Hi {name}” for employees only. */
  employeeGreetingName?: string;
  /** Login username (employees) — used for sidebar links that exclude the shared `guest` account. */
  employeeUsername?: string;
}) {
  return (
    <I18nAppShell role={role} employeeGreetingName={employeeGreetingName} employeeUsername={employeeUsername}>
      {children}
    </I18nAppShell>
  );
}
