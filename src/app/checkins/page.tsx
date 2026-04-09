import { requireAuth } from '@/server/auth/session';
import { listCheckinsByDateRange } from '@/lib/server/checkinsRepo';
import AppLayout from '@/components/AppLayout';
import CheckinsList from '@/components/CheckinsList';
import LocalizedPageHeading from '@/components/LocalizedPageHeading';

interface SearchParams {
  date?: string;
  start_date?: string;
  end_date?: string;
}

export default async function CheckinsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireAuth('admin');
  const params = await searchParams;
  // Single-day filter: date=YYYY-MM-DD. Backward compat: start_date/end_date.
  const startISO = params.date ?? params.start_date;
  const endISO = params.date ?? params.end_date;
  const checkins = await listCheckinsByDateRange(startISO, endISO);

  return (
    <AppLayout
      role={session.role}
      employeeGreetingName={
        session.role === 'employee' ? (session.displayName ?? session.username) : undefined
      }
    >
      <div className="container">
        <LocalizedPageHeading titleKey="view_checkins_title" subtitleKey="view_checkins_subtitle" />
        <CheckinsList initialCheckins={checkins} initialDate={params.date} role={session.role} />
      </div>
    </AppLayout>
  );
}
