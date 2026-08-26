import type { CheckIn } from '@/types';
import {
  SECTION_LABELS,
  buildSectionedData,
} from './sectioning';
import {
  formatPaymentBreakdownPipe,
  getRoomPaymentBreakdownDisplay,
  getRoomPaymentMethodEnglishLabel,
} from '@/lib/checkins/roomPaymentSplits';
import { hasStoredPaymentMethodSingle } from '@/lib/checkins/paymentMethods';
import { formatTime } from '@/lib/utils/formatTime';
import { getEntryCount } from '@/lib/checkins/entryCount';

export type ExportRow = Record<string, string | number | null>;

const ROW_TYPE_DATA = 'data';
const ROW_TYPE_SECTION_HEADER = 'section_header';
const ROW_TYPE_SECTION_TOTAL = 'section_total';
const ROW_TYPE_DAY_TOTAL = 'day_total';

function roomCell(checkin: CheckIn): string {
  if (checkin.checkInType === 'food' || checkin.checkInType === 'beer') return '—';
  return String(checkin.room_id);
}

function plateCell(checkin: CheckIn): string {
  if (checkin.checkInType === 'food' || checkin.checkInType === 'beer') return '—';
  return checkin.car_plate ?? '';
}

function foodBeerPaymentCsv(checkin: CheckIn): string {
  if (checkin.payment_splits && checkin.payment_splits.length > 0) {
    return formatPaymentBreakdownPipe(checkin.payment_splits);
  }
  if (!hasStoredPaymentMethodSingle(checkin.payment_method)) return 'Not recorded';
  const pm = getRoomPaymentMethodEnglishLabel(checkin.payment_method);
  return `${pm} $${Number(checkin.cost).toFixed(2)}`;
}

function roomPaymentBreakdownCsv(checkin: CheckIn): string {
  if (checkin.checkInType === 'food' || checkin.checkInType === 'beer') {
    return foodBeerPaymentCsv(checkin);
  }
  const d = getRoomPaymentBreakdownDisplay(checkin);
  if (checkin.payment_splits && checkin.payment_splits.length > 0) {
    return formatPaymentBreakdownPipe(checkin.payment_splits);
  }
  return d.compactPipe;
}

function blankRow(
  rowType: string,
  receiptLabel: string,
  roomTotal: number | null,
  foodTotal: number | null,
  beerTotal: number | null,
  total: number | null
): ExportRow {
  return {
    rowType,
    receipt_number: receiptLabel,
    date: '',
    time: '',
    type: '',
    room: '',
    staff: '',
    plate: '',
    cost: '',
    paymentBreakdown: '',
    notes: '',
    receiptsCaptured: '',
    roomTotal: roomTotal ?? '',
    foodTotal: foodTotal ?? '',
    beerTotal: beerTotal ?? '',
    total: total ?? '',
  };
}

/**
 * Build export rows for CSV. When includeGrouping is true (single-day filter),
 * output matches the UI: section headers, data rows per section, section totals, day total.
 * When false, flat list of data rows only.
 */
export function buildCheckinsExportRows(options: {
  checkins: CheckIn[];
  includeGrouping: boolean;
}): ExportRow[] {
  const { checkins, includeGrouping } = options;
  const rows: ExportRow[] = [];

  if (!includeGrouping || checkins.length === 0) {
    for (const c of checkins) {
      rows.push({
        rowType: ROW_TYPE_DATA,
        receipt_number: c.receipt_number,
        date: c.date,
        time: formatTime(c.time) || c.time,
        type: c.checkInType ?? 'room',
        room: roomCell(c),
        staff: c.staff_name ?? '',
        plate: plateCell(c),
        cost: Number(c.cost),
        paymentBreakdown: roomPaymentBreakdownCsv(c),
        notes: c.note ?? '',
        receiptsCaptured: getEntryCount(c),
        roomTotal: '',
        foodTotal: '',
        beerTotal: '',
        total: '',
      });
    }
    return rows;
  }

  const { buckets, sectionTotals, dayTotals } = buildSectionedData(checkins);

  for (let idx = 0; idx < SECTION_LABELS.length; idx++) {
    rows.push(
      blankRow(ROW_TYPE_SECTION_HEADER, SECTION_LABELS[idx], null, null, null, null)
    );
    for (const c of buckets[idx]) {
      rows.push({
        rowType: ROW_TYPE_DATA,
        receipt_number: c.receipt_number,
        date: c.date,
        time: formatTime(c.time) || c.time,
        type: c.checkInType ?? 'room',
        room: roomCell(c),
        staff: c.staff_name ?? '',
        plate: plateCell(c),
        cost: Number(c.cost),
        paymentBreakdown: roomPaymentBreakdownCsv(c),
        notes: c.note ?? '',
        receiptsCaptured: getEntryCount(c),
        roomTotal: '',
        foodTotal: '',
        beerTotal: '',
        total: '',
      });
    }
    const st = sectionTotals[idx];
    rows.push(
      blankRow(
        ROW_TYPE_SECTION_TOTAL,
        'Section total',
        st.roomCents / 100,
        st.foodCents / 100,
        st.beerCents / 100,
        st.totalCents / 100
      )
    );
  }

  rows.push(
    blankRow(
      ROW_TYPE_DAY_TOTAL,
      'Day total',
      dayTotals.roomCents / 100,
      dayTotals.foodCents / 100,
      dayTotals.beerCents / 100,
      dayTotals.totalCents / 100
    )
  );

  return rows;
}

export const EXPORT_COLUMNS = [
  'Row Type',
  'Receipt #',
  'Date',
  'Time',
  'Type',
  'Room',
  'Staff',
  'Plate',
  'Cost',
  'Payment Breakdown',
  'Notes',
  'Receipts Captured',
  'Room Total',
  'Food Total',
  'Beer Total',
  'Total',
] as const;

const EXPORT_KEYS: (keyof ExportRow)[] = [
  'rowType',
  'receipt_number',
  'date',
  'time',
  'type',
  'room',
  'staff',
  'plate',
  'cost',
  'paymentBreakdown',
  'notes',
  'receiptsCaptured',
  'roomTotal',
  'foodTotal',
  'beerTotal',
  'total',
];

function escapeCsvCell(value: string | number | null): string {
  const s = value === null || value === '' ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/** Turn export rows into CSV string. */
export function exportRowsToCsv(rows: ExportRow[]): string {
  const headerRow = EXPORT_COLUMNS.join(',');
  const dataRows = rows.map((row) =>
    EXPORT_KEYS.map((key) => escapeCsvCell(row[key] ?? null)).join(',')
  );
  return [headerRow, ...dataRows].join('\r\n');
}
