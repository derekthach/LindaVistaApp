import { Suspense } from 'react';
import { requireAuth } from '@/server/auth/session';
import AppLayout from '@/components/AppLayout';
import LocalizedPageHeading from '@/components/LocalizedPageHeading';
import AddPastEntryClient from '@/components/admin/AddPastEntryClient';
import { getMergedCheckoutStaffDisplayNames } from '@/lib/server/checkoutStaffAllowlist';

export const dynamic = 'force-dynamic';

function PastEntryLoading() {
  return (
    <div className="card" style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
      Loading…
    </div>
  );
}

export default async function AddPastEntryPage() {
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
            <LocalizedPageHeading titleKey="past_entry_page_title" subtitleKey="past_entry_page_subtitle" />
          </div>
          <Suspense fallback={<PastEntryLoading />}>
            <AddPastEntryClient staffNames={staffNames} />
          </Suspense>
        </div>
      </div>
    </AppLayout>
  );
}
