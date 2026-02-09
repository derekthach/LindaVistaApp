'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/actions/auth';
import type { UserRole } from '@/types';

export default function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();

  const linkStyle = (href: string) => ({
    padding: '10px 12px',
    borderRadius: 8,
    background: pathname === href ? '#14532d' : 'transparent',
    color: '#fff',
  });

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
        <div style={{ fontWeight: 700, fontSize: 18 }}>Linda Vista Motel</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
          {role === 'admin' ? 'Admin Mode' : 'Employee Mode'}
        </div>
      </div>

      <nav style={{ display: 'grid', gap: 8, padding: 16 }}>
        {role === 'admin' && (
          <Link href="/dashboard" style={linkStyle('/dashboard')}>
            Dashboard
          </Link>
        )}
        <Link href="/checkin" style={linkStyle('/checkin')}>
          Check-In
        </Link>
        {role === 'admin' && (
          <Link href="/checkins" style={linkStyle('/checkins')}>
            View Check-Ins
          </Link>
        )}
      </nav>

      <div style={{ marginTop: 'auto', padding: 16 }}>
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
            Logout
          </button>
        </form>
      </div>
    </aside>
  );
}
