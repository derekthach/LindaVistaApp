import { requireAuth } from '@/server/auth/session';
import AppLayout from '@/components/AppLayout';
import CheckInTypeSelector from '@/components/checkins/CheckInTypeSelector';
import CheckoutRoomsSection from '@/components/checkins/CheckoutRoomsSection';
import AdminRedirectToDashboard from '@/components/AdminRedirectToDashboard';
import LocalizedPageHeading from '@/components/LocalizedPageHeading';

export default async function NewCheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await requireAuth();
  const params = await searchParams;
  const fromLogin = params.from === 'login';
  const employeeGreetingName =
    session.role === 'employee' ? (session.displayName ?? session.username) : undefined;

  // Only redirect admins to dashboard when they landed here from login (single-cookie / Preview flow).
  // When an admin clicks "Check-In" in the sidebar, they get the normal check-in page.
  if (session.role === 'admin' && fromLogin) {
    return (
      <AppLayout role={session.role} employeeGreetingName={employeeGreetingName}>
        <AdminRedirectToDashboard />
      </AppLayout>
    );
  }

  return (
    <AppLayout role={session.role} employeeGreetingName={employeeGreetingName}>
      <div className="container">
        <LocalizedPageHeading titleKey="check_in_checkout_title" subtitleKey="choose_type" />
        <CheckInTypeSelector />
        <CheckoutRoomsSection
          checkoutVariant={session.role === 'employee' ? 'employee' : 'admin'}
          employeeCleanerName={session.displayName ?? session.username}
        />
      </div>
    </AppLayout>
  );
}
