'use client';

import { useEffect } from 'react';

/** Ensures lv_admin cookie is set when viewing dashboard (e.g. direct nav or after login). */
export default function DashboardEnsureAdminCookie() {
  useEffect(() => {
    fetch('/api/auth/refresh-admin-cookie', { credentials: 'same-origin' }).catch(() => {});
  }, []);
  return null;
}
