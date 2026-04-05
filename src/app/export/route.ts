import { NextRequest, NextResponse } from 'next/server';
import { requireSessionApi } from '@/server/auth/session';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { listCheckinsByDateRange } from '@/lib/server/checkinsRepo';
import { logError, logInfo } from '@/lib/server/log';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';
import { requireEnvs } from '@/lib/server/requireEnv';
import { buildCheckinsExportRows, exportRowsToCsv } from '@/lib/checkins/export';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  logInfo('api.export.start', { requestId });

  try {
    if (process.env.NODE_ENV === 'production') {
      requireEnvs(['SESSION_SECRET']);
    }
    const session = await requireSessionApi();
    if (session.role !== 'admin') {
      throw new HttpError(403, 'FORBIDDEN', { message: 'Admin only' });
    }
    await requireAdmin(request);
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date') ?? undefined;
    const startDate = searchParams.get('start_date') ?? undefined;
    const endDate = searchParams.get('end_date') ?? undefined;
    const startISO = date ?? startDate;
    const endISO = date ?? endDate;

    const checkins = await listCheckinsByDateRange(startISO, endISO);
    const includeGrouping = Boolean(date);
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
    logError('api.export.error', { requestId, message: String(err) });
    const { status, body } = toErrorResponse(error, requestId);
    return NextResponse.json(body, { status });
  }
}
