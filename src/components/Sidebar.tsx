'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/actions/auth';
import type { UserRole } from '@/types';

export default function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();

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
        <Link href="/checkins/new" style={linkStyle('/checkins/new')}>
          Check-In
        </Link>
        {role === 'admin' && (
          <Link href="/checkins" style={linkStyle('/checkins', true)}>
            View Check-Ins
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
            Logout
          </button>
        </form>
      </div>
    </aside>
  );
}
