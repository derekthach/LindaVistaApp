'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { UserRole } from '@/types';
import Sidebar from '@/components/Sidebar';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import { LanguageToggle } from '@/components/LanguageToggle';
import InactivityGuard from '@/components/InactivityGuard';
import SessionTouchOnNavigate from '@/components/SessionTouchOnNavigate';
import { useTranslation } from '@/lib/i18n/useTranslation';

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function AppShellContent({
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
  const pathname = usePathname();
  const { t } = useTranslation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  return (
    <div className="app-shell">
      {mobileNavOpen ? (
        <button
          type="button"
          className="app-sidebar-backdrop"
          aria-label={t('nav_close_menu')}
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      <Sidebar
        role={role}
        employeeGreetingName={employeeGreetingName}
        employeeUsername={employeeUsername}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <main className="app-main">
        <SessionTouchOnNavigate />
        <div className="app-main-header">
          <button
            type="button"
            className="app-mobile-nav-toggle"
            aria-label={t('nav_open_menu')}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
          >
            <MenuIcon />
          </button>
          <div style={{ marginLeft: 'auto' }}>
            <LanguageToggle />
          </div>
        </div>
        {role === 'employee' && <InactivityGuard />}
        {children}
      </main>
    </div>
  );
}

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
      <AppShellContent
        role={role}
        employeeGreetingName={employeeGreetingName}
        employeeUsername={employeeUsername}
      >
        {children}
      </AppShellContent>
    </I18nProvider>
  );
}
