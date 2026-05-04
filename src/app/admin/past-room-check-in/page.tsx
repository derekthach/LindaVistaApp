import { requireAuth } from '@/server/auth/session';
import AppLayout from '@/components/AppLayout';
import LocalizedPageHeading from '@/components/LocalizedPageHeading';
import PastRoomCheckinForm from '@/components/admin/PastRoomCheckinForm';
import { getMergedCheckoutStaffDisplayNames } from '@/lib/server/checkoutStaffAllowlist';

export const dynamic = 'force-dynamic';

export default async function PastRoomCheckInPage() {
  const session = await requireAuth('admin');
  const staffNames = await getMergedCheckoutStaffDisplayNames();

  return (
    <AppLayout
      role={session.role}
      employeeGreetingName={
        session.role === 'employee' ? (session.displayName ?? session.username) : undefined
      }
      employeeUsername={session.role === 'employee' ? session.username : undefined}
    >
      <div className="container">
        <div
          style={{
            maxWidth: 960,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <LocalizedPageHeading titleKey="past_room_checkin_title" subtitleKey="past_room_checkin_page_subtitle" />
          </div>
          <PastRoomCheckinForm staffNames={staffNames} />
        </div>
      </div>
    </AppLayout>
  );
}
