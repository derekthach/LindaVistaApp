import Sidebar from './Sidebar';
import AppContentWithLanguage from './AppContentWithLanguage';
import type { UserRole } from '@/types';

export default function AppLayout({
  children,
  role,
}: {
  children: React.ReactNode;
  role: UserRole;
}) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar role={role} />
      <main style={{ flex: 1, padding: 24 }}>
        <AppContentWithLanguage role={role}>{children}</AppContentWithLanguage>
      </main>
    </div>
  );
}
