import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { listCheckinsByDateRange } from '@/lib/server/checkinsRepo';
import {
  applyAdvancedFilters,
  parseAdvancedFiltersFromSearchParams,
} from '@/lib/checkins/advancedFilters';
import { logError, logInfo } from '@/lib/server/log';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';
import { buildCheckinsExportRows, exportRowsToCsv } from '@/lib/checkins/export';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  logInfo('api.admin.checkins.export.start', { requestId });

  try {
    await requireAdmin(request);
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date') ?? undefined;
    const startDate = searchParams.get('start_date') ?? undefined;
    const endDate = searchParams.get('end_date') ?? undefined;
    const startISO = date ?? startDate;
    const endISO = date ?? endDate;

    const filters = parseAdvancedFiltersFromSearchParams({
      receipt: searchParams.get('receipt') ?? undefined,
      shift: searchParams.get('shift') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      room: searchParams.get('room') ?? undefined,
      staff: searchParams.get('staff') ?? undefined,
      payment: searchParams.get('payment') ?? undefined,
    });

    const raw = await listCheckinsByDateRange(startISO, endISO);
    const checkins = applyAdvancedFilters(raw, filters);
    const includeGrouping = Boolean(startISO && endISO && startISO === endISO);
    const exportRows = buildCheckinsExportRows({ checkins, includeGrouping });
    const csvContent = exportRowsToCsv(exportRows);

    let filename = 'checkins_export';
    if (date) {
      filename += `_${date}`;
    } else if (startDate && endDate) {
      filename += `_${startDate}_to_${endDate}`;
    } else if (startDate) {
      filename += `_from_${startDate}`;
    } else if (endDate) {
      filename += `_until_${endDate}`;
    }
    filename += '.csv';

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const error = err instanceof HttpError ? err : new HttpError(401, 'UNAUTHORIZED');
    logError('api.admin.checkins.export.error', { requestId, message: String(err) });
    const { status, body } = toErrorResponse(error, requestId);
    return NextResponse.json(body, { status });
  }
}
