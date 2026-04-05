import { requireAuth } from '@/server/auth/session';
import AppLayout from '@/components/AppLayout';
import CheckInTypeSelector from '@/components/checkins/CheckInTypeSelector';
import CheckoutRoomsSection from '@/components/checkins/CheckoutRoomsSection';
import AdminRedirectToDashboard from '@/components/AdminRedirectToDashboard';

export default async function NewCheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await requireAuth();
  const params = await searchParams;
  const fromLogin = params.from === 'login';

  // Only redirect admins to dashboard when they landed here from login (single-cookie / Preview flow).
  // When an admin clicks "Check-In" in the sidebar, they get the normal check-in page.
  if (session.role === 'admin' && fromLogin) {
    return (
      <AppLayout role={session.role}>
        <AdminRedirectToDashboard />
      </AppLayout>
    );
  }

  return (
    <AppLayout role={session.role}>
      <div className="container">
        <h1 className="page-title">Check-In / Checkout</h1>
        <p className="page-subtitle">Choose what you are registering</p>
        <CheckInTypeSelector />
        <CheckoutRoomsSection
          checkoutVariant={session.role === 'employee' ? 'employee' : 'admin'}
          employeeCleanerName={session.displayName ?? session.username}
        />
      </div>
    </AppLayout>
  );
}
