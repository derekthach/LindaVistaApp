'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/actions/auth';
import { LV_PENDING_RESETS_INVALIDATE } from '@/lib/adminNavEvents';
import { isGuestEmployeeUsername } from '@/lib/auth/guestEmployee';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { UserRole } from '@/types';

export default function Sidebar({
  role,
  employeeGreetingName,
  employeeUsername,
}: {
  role: UserRole;
  /** First-party name for “Hi {name}” (employees only). */
  employeeGreetingName?: string;
  /** Login username — when set with role employee, enables employee-only nav (excluding shared guest). */
  employeeUsername?: string;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [pendingResetCount, setPendingResetCount] = useState(0);

  const fetchPendingResets = useCallback(async () => {
    if (role !== 'admin') return;
    try {
      const res = await fetch('/api/admin/pending-password-resets-count');
      if (!res.ok) return;
      const data = (await res.json()) as { count?: number };
      setPendingResetCount(typeof data.count === 'number' ? data.count : 0);
    } catch {
      /* ignore */
    }
  }, [role]);

  // Load once per admin shell mount (not on every pathname change).
  useEffect(() => {
    void fetchPendingResets();
  }, [fetchPendingResets]);

  useEffect(() => {
    if (role !== 'admin') return;
    const onInvalidate = () => void fetchPendingResets();
    window.addEventListener(LV_PENDING_RESETS_INVALIDATE, onInvalidate);
    return () => window.removeEventListener(LV_PENDING_RESETS_INVALIDATE, onInvalidate);
  }, [role, fetchPendingResets]);

  const linkStyle = (href: string, exact?: boolean) => {
    const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
    return {
      padding: '10px 12px',
      borderRadius: 8,
      background: isActive ? '#14532d' : 'transparent',
      color: '#fff',
    };
  };

  return (
    <aside
      style={{
        width: 240,
        background: '#166534',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{t('login_title')}</div>
        {role === 'employee' && employeeGreetingName?.trim() ? (
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8, opacity: 0.95 }}>
            {t('sidebar_employee_greeting', { name: employeeGreetingName.trim() })}
          </div>
        ) : null}
        <div
          style={{
            fontSize: 12,
            opacity: 0.8,
            marginTop: role === 'employee' && employeeGreetingName?.trim() ? 6 : 4,
          }}
        >
          {role === 'admin' ? t('admin_mode') : t('employee_mode')}
        </div>
      </div>

      <nav style={{ display: 'grid', gap: 8, padding: 16 }}>
        {role === 'admin' && (
          <Link href="/dashboard" prefetch={false} style={linkStyle('/dashboard')}>
            {t('nav_dashboard')}
          </Link>
        )}
        <Link href="/checkins/new" style={linkStyle('/checkins/new')}>
          {t('nav_checkin_checkout')}
        </Link>
        {role === 'employee' &&
          employeeUsername &&
          !isGuestEmployeeUsername(employeeUsername) && (
            <Link href="/employee/recent-checkins" style={linkStyle('/employee/recent-checkins', true)}>
              {t('nav_recent_checkins')}
            </Link>
          )}
        {role === 'admin' && (
          <Link
            href="/admin/employees"
            prefetch={false}
            style={{
              ...linkStyle('/admin/employees'),
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              justifyContent: 'space-between',
            }}
            aria-label={
              pendingResetCount > 0
                ? pendingResetCount === 1
                  ? t('employees_nav_pending_aria', { count: pendingResetCount })
                  : t('employees_nav_pending_aria_plural', { count: pendingResetCount })
                : t('nav_employees')
            }
          >
            <span>{t('nav_employees')}</span>
            {pendingResetCount > 0 ? (
              <span
                aria-hidden
                title={
                  pendingResetCount === 1
                    ? t('employees_nav_pending_aria', { count: pendingResetCount })
                    : t('employees_nav_pending_aria_plural', { count: pendingResetCount })
                }
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: '#facc15',
                  flexShrink: 0,
                  boxShadow: '0 0 0 2px rgba(22, 101, 52, 0.95)',
                }}
              />
            ) : null}
          </Link>
        )}
        {role === 'admin' && (
          <Link href="/checkins" prefetch={false} style={linkStyle('/checkins', true)}>
            {t('nav_view_checkins')}
          </Link>
        )}
        {role === 'admin' && (
          <Link href="/admin/add-past-entry" prefetch={false} style={linkStyle('/admin/add-past-entry', true)}>
            {t('nav_add_past_entry')}
          </Link>
        )}
      </nav>

      <div style={{ marginTop: 16, padding: 16 }}>
        <form action={logoutAction}>
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: 'none',
              background: '#b91c1c',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('logout')}
          </button>
        </form>
      </div>
    </aside>
  );
}
