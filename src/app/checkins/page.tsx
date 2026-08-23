import { requireAuth } from '@/server/auth/session';
import { DateTime } from 'luxon';
import { listCheckinsByDateRange, listRecentCheckinsByCreatedAt } from '@/lib/server/checkinsRepo';
import { listRoomTurnoversForBusinessDate } from '@/lib/server/shiftSummariesRepo';
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
  const isDay = resolved.kind === 'day';

  const [checkins, turnoversRaw] = await Promise.all([
    resolved.kind === 'all'
      ? listRecentCheckinsByCreatedAt()
      : listCheckinsByDateRange(startISO, endISO),
    isDay ? listRoomTurnoversForBusinessDate(resolved.dateISO) : Promise.resolve([]),
  ]);

  const initialDate = isDay ? resolved.dateISO : undefined;
  const initialTurnovers = turnoversRaw.map((t) => ({
    id: t.id,
    checkedOutAt: t.checkedOutAt.toISOString(),
    cleanedAt: t.cleanedAt.toISOString(),
  }));

  logInfo('checkins.page.complete', {
    mode: resolved.kind,
    docsReturned: checkins.length,
    turnoverDocsReturned: initialTurnovers.length,
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
          initialTurnovers={initialTurnovers}
          role={session.role}
          viewingAll={resolved.kind === 'all'}
        />
      </div>
    </AppLayout>
  );
}
