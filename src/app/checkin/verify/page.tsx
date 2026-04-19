import { requireAuth } from '@/server/auth/session';
import AppLayout from '@/components/AppLayout';
import VerifyCheckinForm from '@/components/VerifyCheckinForm';
import LocalizedPageHeading from '@/components/LocalizedPageHeading';
import { logInfo } from '@/lib/server/log';

export const dynamic = 'force-dynamic';

export default async function VerifyCheckinPage() {
  const session = await requireAuth();
  logInfo('checkin.room.verify.view', {
    role: session.role,
    username: session.username,
  });

  return (
    <AppLayout
      role={session.role}
      employeeGreetingName={
        session.role === 'employee' ? (session.displayName ?? session.username) : undefined
      }
      employeeUsername={session.role === 'employee' ? session.username : undefined}
    >
      <div className="container">
        <LocalizedPageHeading titleKey="verify" subtitleKey="review_before_submitting" />
        <VerifyCheckinForm />
      </div>
    </AppLayout>
  );
}
