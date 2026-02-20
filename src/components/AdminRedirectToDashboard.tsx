'use client';

import { useEffect } from 'react';

const LOG_PREFIX = '[Linda Vista]';

export default function AdminRedirectToDashboard() {
  useEffect(() => {
    console.log(LOG_PREFIX, 'Admin detected on /checkins/new — redirecting to dashboard');
    window.location.replace('/dashboard');
  }, []);

  return (
    <div className="container" style={{ padding: 24 }}>
      <p style={{ fontSize: 18 }}>Taking you to the dashboard…</p>
    </div>
  );
}
