import { redirect } from 'next/navigation';
import { requireAuth } from '@/server/auth/session';
import AppLayout from '@/components/AppLayout';
import CheckInTypeSelector from '@/components/checkins/CheckInTypeSelector';

export default async function NewCheckinPage() {
  const session = await requireAuth();
  if (session.role === 'admin') redirect('/dashboard');

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
