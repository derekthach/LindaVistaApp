/**
 * Resolves View Check-ins list query params without loading unbounded history by default.
 * America/Puerto_Rico “today” is supplied by the caller (keeps this helper pure/testable).
 *
 * Bare `/checkins` resolves in-place to today’s day query (no redirect hop) so App Router
 * soft navigation keeps the admin shell mounted.
 */

export type ViewCheckinsSearchParams = {
  date?: string;
  start_date?: string;
  end_date?: string;
  /** Explicit opt-in to the unfiltered (capped) history list. */
  all?: string;
};

export type ViewCheckinsResolved =
  | { kind: 'day'; dateISO: string; startISO: string; endISO: string }
  | { kind: 'range'; startISO: string; endISO: string; dateISO?: undefined }
  | { kind: 'all'; startISO?: undefined; endISO?: undefined; dateISO?: undefined };

function isIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function wantsAllCheckins(params: ViewCheckinsSearchParams): boolean {
  const raw = params.all?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

/**
 * Default: Puerto Rico calendar day (in-place, no redirect).
 * Opt-in history dump: `?all=1` (still server-capped by listCheckinsByDateRange).
 * Explicit `date` or `start_date`+`end_date` preserved for navigation/export flows.
 */
export function resolveViewCheckinsQuery(
  params: ViewCheckinsSearchParams,
  todayISO: string
): ViewCheckinsResolved {
  if (isIsoDate(params.date)) {
    return { kind: 'day', dateISO: params.date, startISO: params.date, endISO: params.date };
  }

  if (isIsoDate(params.start_date) && isIsoDate(params.end_date)) {
    return { kind: 'range', startISO: params.start_date, endISO: params.end_date };
  }

  if (isIsoDate(params.start_date) && !params.end_date) {
    return { kind: 'day', dateISO: params.start_date, startISO: params.start_date, endISO: params.start_date };
  }

  if (wantsAllCheckins(params)) {
    return { kind: 'all' };
  }

  if (isIsoDate(todayISO)) {
    return { kind: 'day', dateISO: todayISO, startISO: todayISO, endISO: todayISO };
  }

  return { kind: 'all' };
}
