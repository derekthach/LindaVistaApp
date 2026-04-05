import { requireAuth } from '@/server/auth/session';
import ChangePasswordForm from '@/components/ChangePasswordForm';
import SessionTouchOnNavigate from '@/components/SessionTouchOnNavigate';

export const dynamic = 'force-dynamic';

export default async function EmployeeChangePasswordPage() {
  await requireAuth(undefined, 'change-password');

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: '#f3f4f6',
      }}
    >
      <SessionTouchOnNavigate />
      <div className="card" style={{ width: '100%', maxWidth: 420 }}>
        <h1 className="page-title" style={{ fontSize: 22 }}>
          Cambiar contraseña
        </h1>
        <p className="page-subtitle" style={{ marginBottom: 20 }}>
          Debe elegir una nueva contraseña antes de continuar.
        </p>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
