import { requireAuth } from '@/server/auth/session';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { listCheckinsByDateRange } from '@/lib/server/checkinsRepo';
import AppLayout from '@/components/AppLayout';
import CheckinsList from '@/components/CheckinsList';

interface SearchParams {
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
  const checkins = await listCheckinsByDateRange(params.start_date, params.end_date);

  return (
    <AppLayout role={session.role}>
      <div className="container">
        <h1 className="page-title">View Check-Ins</h1>
        <p className="page-subtitle">Browse and export check-in history</p>
        <CheckinsList initialCheckins={checkins} />
      </div>
    </AppLayout>
  );
}
