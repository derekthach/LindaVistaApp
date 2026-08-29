import { requireAuth } from '@/server/auth/session';
import { DateTime } from 'luxon';
import { listCheckinsByDateRange, listRecentCheckinsByCreatedAt } from '@/lib/server/checkinsRepo';
import { loadViewCheckinsRangeOverview } from '@/lib/server/viewCheckinsRangeOverview';
import AppLayout from '@/components/AppLayout';
import CheckinsList from '@/components/CheckinsList';
import LocalizedPageHeading from '@/components/LocalizedPageHeading';
import { resolveViewCheckinsQuery } from '@/lib/checkins/viewCheckinsQuery';
import type { ViewCheckinsDateRangeErrorCode } from '@/lib/checkins/dateRangeFilter';
import type { ViewCheckinsRangeOverview } from '@/lib/server/viewCheckinsRangeOverview';
import type { CheckIn } from '@/types';
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

  let checkins: CheckIn[] = [];
  let rangeOverview: ViewCheckinsRangeOverview | null = null;

  if (resolved.kind === 'all') {
    checkins = await listRecentCheckinsByCreatedAt();
  } else if (resolved.kind === 'invalid') {
    checkins = [];
  } else if (resolved.kind === 'day') {
    checkins = await listCheckinsByDateRange(resolved.startISO, resolved.endISO);
  } else {
    // Multi-day: summary docs only — no raw check-in range fetch.
    rangeOverview = await loadViewCheckinsRangeOverview(resolved.startISO, resolved.endISO);
  }

  const initialStartDate =
    resolved.kind === 'day' || resolved.kind === 'range' || resolved.kind === 'invalid'
      ? resolved.startISO
      : todayISO;
  const initialEndDate =
    resolved.kind === 'day' || resolved.kind === 'range' || resolved.kind === 'invalid'
      ? resolved.endISO
      : todayISO;

  const rangeError: ViewCheckinsDateRangeErrorCode | undefined =
    resolved.kind === 'invalid' ? resolved.error : undefined;

  const startForUi = initialStartDate || todayISO;
  const endForUi = initialEndDate || todayISO;

  logInfo('checkins.page.complete', {
    mode: resolved.kind,
    docsReturned: checkins.length,
    overviewDays: rangeOverview?.days.length ?? null,
    startISO: resolved.kind === 'all' ? null : resolved.startISO,
    endISO: resolved.kind === 'all' ? null : resolved.endISO,
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
          initialStartDate={startForUi}
          initialEndDate={endForUi}
          todayISO={todayISO}
          rangeError={rangeError}
          rangeOverview={rangeOverview}
          role={session.role}
          viewingAll={resolved.kind === 'all'}
        />
      </div>
    </AppLayout>
  );
}
