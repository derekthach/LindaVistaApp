'use client';

import { useEffect } from 'react';

const LOG_PREFIX = '[Linda Vista]';

export default function AdminRedirectToDashboard() {
  useEffect(() => {
    async function goToDashboard() {
      // Set admin cookie in a separate request so login only sends one Set-Cookie
      // (fixes Preview envs where two cookies in one response can drop one)
      try {
        await fetch('/api/auth/refresh-admin-cookie', { credentials: 'same-origin' });
      } finally {
        window.location.replace('/dashboard');
      }
    }
    console.log(LOG_PREFIX, 'Admin detected on /checkins/new — redirecting to dashboard');
    goToDashboard();
  }, []);

  return (
    <div className="container" style={{ padding: 24 }}>
      <p style={{ fontSize: 18 }}>Taking you to the dashboard…</p>
    </div>
  );
}
