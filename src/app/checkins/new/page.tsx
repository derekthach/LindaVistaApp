import { requireAuth } from '@/server/auth/session';
import AppLayout from '@/components/AppLayout';
import CheckInTypeSelector from '@/components/checkins/CheckInTypeSelector';
import AdminRedirectToDashboard from '@/components/AdminRedirectToDashboard';

export default async function NewCheckinPage() {
  const session = await requireAuth();

  if (session.role === 'admin') {
    return (
      <AppLayout role={session.role}>
        <AdminRedirectToDashboard />
      </AppLayout>
    );
  }

  return (
    <AppLayout role={session.role}>
      <div className="container">
        <h1 className="page-title">New Check-In</h1>
        <p className="page-subtitle">Choose what you are registering</p>
        <CheckInTypeSelector />
      </div>
    </AppLayout>
  );
}
