import I18nAppShell from './I18nAppShell';
import type { UserRole } from '@/types';

export default function AppLayout({
  children,
  role,
}: {
  children: React.ReactNode;
  role: UserRole;
}) {
  return <I18nAppShell role={role}>{children}</I18nAppShell>;
}
