import { requireAuth } from '@/server/auth/session';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { listCheckinsByDateRange } from '@/lib/server/checkinsRepo';
import AppLayout from '@/components/AppLayout';
import CheckinsList from '@/components/CheckinsList';

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
  await requireAdmin();
  const params = await searchParams;
  // Single-day filter: date=YYYY-MM-DD. Backward compat: start_date/end_date.
  const startISO = params.date ?? params.start_date;
  const endISO = params.date ?? params.end_date;
  const checkins = await listCheckinsByDateRange(startISO, endISO);

  return (
    <AppLayout role={session.role}>
      <div className="container">
        <h1 className="page-title">View Check-Ins</h1>
        <p className="page-subtitle">Browse and export check-in history</p>
        <CheckinsList initialCheckins={checkins} initialDate={params.date} role={session.role} />
      </div>
    </AppLayout>
  );
}
