import { requireAuth } from '@/server/auth/session';
import AppLayout from '@/components/AppLayout';
import VerifyCheckinForm from '@/components/VerifyCheckinForm';

export default async function VerifyCheckinPage() {
  const session = await requireAuth();

  return (
    <AppLayout role={session.role}>
      <div className="container">
        <h1 className="page-title">Verify Check-In</h1>
        <p className="page-subtitle">Review the information before submitting</p>
        <VerifyCheckinForm />
      </div>
    </AppLayout>
  );
}
