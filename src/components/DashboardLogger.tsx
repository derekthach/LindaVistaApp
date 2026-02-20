'use client';

import { useEffect } from 'react';

export default function DashboardLogger() {
  useEffect(() => {
    console.log('[Linda Vista] Dashboard loaded');
  }, []);
  return null;
}
