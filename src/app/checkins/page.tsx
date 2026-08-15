import { requireAuth } from '@/server/auth/session';
import { DateTime } from 'luxon';
import { listCheckinsByDateRange } from '@/lib/server/checkinsRepo';
import AppLayout from '@/components/AppLayout';
import CheckinsList from '@/components/CheckinsList';
import LocalizedPageHeading from '@/components/LocalizedPageHeading';
import { resolveViewCheckinsQuery } from '@/lib/checkins/viewCheckinsQuery';
import { logInfo } from '@/lib/server/log';

const ZONE = 'America/Puerto_Rico';

interface SearchParams {
  date?: string;
  start_date?: string;
  end_date?: string;
  all?: string;
}

export default async function CheckinsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireAuth('admin');
  const params = await searchParams;
  const todayISO = DateTime.now().setZone(ZONE).toISODate() ?? '';
  const resolved = resolveViewCheckinsQuery(params, todayISO);

  const startISO = resolved.kind === 'all' ? undefined : resolved.startISO;
  const endISO = resolved.kind === 'all' ? undefined : resolved.endISO;
  const checkins = await listCheckinsByDateRange(startISO, endISO);
  const initialDate = resolved.kind === 'day' ? resolved.dateISO : undefined;

  logInfo('checkins.page.complete', {
    mode: resolved.kind,
    docsReturned: checkins.length,
    startISO: startISO ?? null,
    endISO: endISO ?? null,
  });

  return (
    <AppLayout
      role={session.role}
      employeeGreetingName={
        session.role === 'employee' ? (session.displayName ?? session.username) : undefined
      }
    >
      <div className="container">
        <LocalizedPageHeading titleKey="view_checkins_title" subtitleKey="view_checkins_subtitle" />
        <CheckinsList
          initialCheckins={checkins}
          initialDate={initialDate}
          role={session.role}
          viewingAll={resolved.kind === 'all'}
        />
      </div>
    </AppLayout>
  );
}
