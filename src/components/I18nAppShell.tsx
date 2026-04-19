'use client';

import type { UserRole } from '@/types';
import Sidebar from '@/components/Sidebar';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import { LanguageToggle } from '@/components/LanguageToggle';
import InactivityGuard from '@/components/InactivityGuard';
import SessionTouchOnNavigate from '@/components/SessionTouchOnNavigate';

export default function I18nAppShell({
  role,
  employeeGreetingName,
  employeeUsername,
  children,
}: {
  role: UserRole;
  employeeGreetingName?: string;
  employeeUsername?: string;
  children: React.ReactNode;
}) {
  const defaultLanguage = role === 'employee' ? 'es' : undefined;

  return (
    <I18nProvider defaultLanguage={defaultLanguage}>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar role={role} employeeGreetingName={employeeGreetingName} employeeUsername={employeeUsername} />
        <main style={{ flex: 1, padding: 24 }}>
          <SessionTouchOnNavigate />
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: 16,
            }}
          >
            <LanguageToggle />
          </div>
          {role === 'employee' && <InactivityGuard />}
          {children}
        </main>
      </div>
    </I18nProvider>
  );
}
