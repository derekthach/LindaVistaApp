import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { listCheckinsByDateRange } from '@/lib/server/checkinsRepo';
import { logError, logInfo } from '@/lib/server/log';
import { HttpError, toErrorResponse } from '@/lib/server/httpError';

export const runtime = 'nodejs';

function buildCsv(checkins: Awaited<ReturnType<typeof listCheckinsByDateRange>>): string {
  const headers = ['Receipt #', 'Date', 'Time', 'Room', 'Staff', 'Plate', 'Cost', 'Notes'];
  const rows = checkins.map((c) => [
    c.receipt_number,
    c.date,
    c.time,
    String(c.room_id),
    c.staff_name,
    c.car_plate,
    String(c.cost),
    c.note ?? '',
  ]);
  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((row) => row.map(escape).join(','))].join('\r\n');
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  logInfo('api.admin.checkins.export.start', { requestId });

  try {
    await requireAdmin(request);
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date') ?? undefined;
    const endDate = searchParams.get('end_date') ?? undefined;

    const checkins = await listCheckinsByDateRange(startDate, endDate);
    const csvContent = buildCsv(checkins);

    let filename = 'checkins_export';
    if (startDate && endDate) {
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
