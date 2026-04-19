'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/useTranslation';

/** Subtle link from Check-In/Checkout → dedicated recent check-ins page (non-guest employees). */
export default function EmployeeRecentCheckinsNavLink() {
  const { t } = useTranslation();
  return (
    <div style={{ marginTop: 16 }}>
      <Link
        href="/employee/recent-checkins"
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#166534',
          textDecoration: 'none',
        }}
      >
        {t('employee_recent_page_link')}
      </Link>
    </div>
  );
}
