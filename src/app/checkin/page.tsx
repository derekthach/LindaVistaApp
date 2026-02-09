import { requireAuth } from '@/server/auth/session';
import AppLayout from '@/components/AppLayout';
import CheckinForm from '@/components/CheckinForm';

export default async function CheckinPage() {
  const session = await requireAuth();

  return (
    <AppLayout role={session.role}>
      <div className="container">
        <h1 className="page-title">Check-In</h1>
        <p className="page-subtitle">Register a new guest check-in</p>
        <CheckinForm />
      </div>
    </AppLayout>
  );
}
