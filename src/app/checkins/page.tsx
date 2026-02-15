import { requireAuth } from '@/server/auth/session';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { listCheckinsByDateRange } from '@/lib/server/checkinsRepo';
import AppLayout from '@/components/AppLayout';
import CheckinsList from '@/components/CheckinsList';
import type { CheckIn } from '@/types';

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

  let checkins: CheckIn[] = [];
  let listError: string | null = null;
  try {
    checkins = await listCheckinsByDateRange(params.start_date, params.end_date);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isCredsError =
      message.includes('Could not load the default credentials') ||
      message.includes('default credentials') ||
      message.includes('invalid_grant') ||
      message.includes('invalid_rapt') ||
      message.includes('Getting metadata from plugin');
    listError = isCredsError
      ? 'Check-ins could not be loaded: Firebase credentials are missing or invalid. Set Firebase env vars in Vercel (or .env.local) and redeploy.'
      : `Could not load check-ins: ${message}`;
  }

  return (
    <AppLayout role={session.role}>
      <div className="container">
        <h1 className="page-title">View Check-Ins</h1>
        <p className="page-subtitle">Browse and export check-in history</p>
        {listError && (
          <div
            role="alert"
            style={{
              padding: 12,
              marginBottom: 16,
              background: 'rgba(255, 193, 7, 0.15)',
              border: '1px solid rgba(255, 193, 7, 0.5)',
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            {listError}
          </div>
        )}
        <CheckinsList initialCheckins={checkins} />
      </div>
    </AppLayout>
  );
}
