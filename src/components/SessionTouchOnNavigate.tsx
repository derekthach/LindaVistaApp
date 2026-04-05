'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Keeps server-side inactivity tracking accurate across RSC navigations (cookie touch only in Route Handler).
 */
export default function SessionTouchOnNavigate() {
  const pathname = usePathname();

  useEffect(() => {
    void fetch('/api/auth/touch-session', { method: 'POST', credentials: 'include' });
  }, [pathname]);

  return null;
}
