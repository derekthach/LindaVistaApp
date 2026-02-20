import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import LoginPageLogger from '@/components/LoginPageLogger';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await getSession();
  if (session.isLoggedIn) {
    redirect(session.role === 'admin' ? '/dashboard' : '/checkins/new');
  }

  return (
    <>
      <LoginPageLogger />
      <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        backgroundImage: 'url(/logo1p.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
          zIndex: 0,
        }}
        aria-hidden
      />
      <div className="card" style={{ width: 420, position: 'relative', zIndex: 1 }}>
        <h1 className="page-title">Linda Vista Motel</h1>
        <p className="page-subtitle">Management System Login</p>

        <form action="/api/auth/login" method="POST" style={{ display: 'grid', gap: 16 }}>
          <label>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Username</div>
            <input
              name="username"
              type="text"
              required
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
            />
          </label>

          <label>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Password</div>
            <input
              name="password"
              type="password"
              required
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
            />
          </label>

          <button
            type="submit"
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: 'none',
              background: '#166534',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
    </>
  );
}
