import I18nAppShell from './I18nAppShell';
import type { UserRole } from '@/types';

export default function AppLayout({
  children,
  role,
  employeeGreetingName,
}: {
  children: React.ReactNode;
  role: UserRole;
  /** Shown in sidebar as “Hi {name}” for employees only. */
  employeeGreetingName?: string;
}) {
  return (
    <I18nAppShell role={role} employeeGreetingName={employeeGreetingName}>
      {children}
    </I18nAppShell>
  );
}
