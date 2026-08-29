'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DateTime } from 'luxon';
import type { CheckIn, CheckInType, UserRole, LineItem, SummarizedItem } from '@/types';
import Button from '@/components/Button';
import { buildSectionedData, paymentMethodTotalsToCents, type SectionTotals } from '@/lib/checkins/sectioning';
import { carColorLabel } from '@/lib/checkins/colors';
import { formatRoomDisplay } from '@/lib/checkins/rooms';
import type { TranslationKey } from '@/lib/i18n/translations';
import EditCheckinModal, { type EditCheckinDraft } from '@/components/checkins/EditCheckinModal';
import ConfirmDiffModal, { type DiffLine } from '@/components/checkins/ConfirmDiffModal';
import EditHistoryPanel from '@/components/checkins/EditHistoryPanel';
import { formatReceiptNumber } from '@/lib/checkins/receipt';
import { useLanguage } from '@/components/LanguageToggle';
import {
  calculatePaymentSplitTotal,
  getRoomPaymentBreakdownDisplayLocalized,
} from '@/lib/checkins/roomPaymentSplits';
import { getPaymentMethodTranslationKey, hasStoredPaymentMethodSingle } from '@/lib/checkins/paymentMethods';
import { getEntryCount } from '@/lib/checkins/entryCount';
import {
  formatGuestAwarePersonDisplay,
  formatStaffDisplayForCheckinsTable,
} from '@/lib/checkins/staffDisplay';
import { formatTime } from '@/lib/utils/formatTime';
import {
  lineItemsFromCheckinRecord,
  foodBeerLineRowsSummary,
  foodBeerLineRowsAmountTotal,
} from '@/lib/checkins/lineItemsFromCheckin';
import {
  validateViewCheckinsDateRange,
  viewCheckinsDateRangeErrorTranslationKey,
  type ViewCheckinsDateRangeErrorCode,
} from '@/lib/checkins/dateRangeFilter';
import type { ViewCheckinsRangeOverview } from '@/lib/server/viewCheckinsRangeOverview';
import PaymentMethodTags from '@/components/checkins/PaymentMethodTags';

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function centsToCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(
    cents / 100
  );
}

function renderTotalsBreakdown(totals: SectionTotals, t: (key: TranslationKey) => string) {
  const carCount = totals.carCount ?? 0;
  return (
    <span
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        gap: '2px 10px',
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <span>
        {t('list_totals_cars')}: {carCount}
      </span>
      <span>
        {t('list_totals_room')}: {centsToCurrency(totals.roomCents)}
      </span>
      <span>
        {t('list_totals_food')}: {centsToCurrency(totals.foodCents)}
      </span>
      <span>
        {t('list_totals_beer')}: {centsToCurrency(totals.beerCents)}
      </span>
      <strong>
        {t('list_totals_label')}: {centsToCurrency(totals.totalCents)}
      </strong>
    </span>
  );
}

export type { SectionTotals } from '@/lib/checkins/sectioning';

const SECTION_BUCKET_KEYS: TranslationKey[] = ['section_bucket_1', 'section_bucket_2', 'section_bucket_3'];

const ZONE = 'America/Puerto_Rico';

function addDaysToISODate(iso: string, days: number): string | null {
  const dt = DateTime.fromISO(iso, { zone: ZONE });
  if (!dt.isValid) return null;
  return dt.plus({ days }).toISODate();
}

function isISODateTodayInPR(iso: string): boolean {
  const dt = DateTime.fromISO(iso, { zone: ZONE }).startOf('day');
  if (!dt.isValid) return false;
  const today = DateTime.now().setZone(ZONE).startOf('day');
  return dt.equals(today);
}

function formatISODateLabel(iso: string, locale: 'en' | 'es'): string {
  const dt = DateTime.fromISO(iso, { zone: ZONE });
  if (!dt.isValid) return iso;
  return dt.setLocale(locale === 'es' ? 'es' : 'en').toFormat('cccc, MMMM d, yyyy');
}

function roomCell(checkin: CheckIn, t: (key: TranslationKey) => string): string | number {
  if (checkin.checkInType === 'food' || checkin.checkInType === 'beer') return '—';
  return formatRoomDisplay(checkin.room_id, t('room'));
}

function receiptCell(checkin: CheckIn): string {
  if (checkin.checkInType === 'food' || checkin.checkInType === 'beer') return '—';
  return formatReceiptNumber(checkin.receipt_number ?? '');
}

function typeCell(checkin: CheckIn, t: (key: TranslationKey) => string): string {
  if (checkin.checkInType === 'food') return t('table_type_food');
  if (checkin.checkInType === 'beer') return t('table_type_beer');
  return t('table_type_room');
}

function orDash(value: string | undefined): string {
  return value?.trim() ? value.trim() : '—';
}

function displayTime(value: string | undefined): string {
  const formatted = formatTime(value);
  return formatted || orDash(value);
}

/** Firestore-backed rows always have `id`; avoid receipt-only keys so duplicate receipts stay distinct in the UI. */
function stableCheckinRowId(c: CheckIn): string {
  if (c.id) return c.id;
  return `legacy:${c.receipt_number}:${c.date}:${c.time}:${String(c.room_id)}:${c.cost}`;
}

const pastEntryMetaStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#78716c',
  fontWeight: 600,
};

function DetailsPanel({ checkin, t }: { checkin: CheckIn; t: (key: TranslationKey) => string }) {
  const isRoom = checkin.checkInType !== 'food' && checkin.checkInType !== 'beer';
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: '6px 16px',
    alignItems: 'baseline',
    fontSize: 13,
  };
  const labelStyle = { color: '#6b7280', fontWeight: 500 };
  const valueStyle = { fontWeight: 500 };

  if (isRoom) {
    const pay = getRoomPaymentBreakdownDisplayLocalized(checkin, (k) => t(k as TranslationKey));
    const isPastEntry = checkin.is_past_entry === true;
    const hasCheckoutData = !isPastEntry && checkin.is_checked_out === true;
    const sectionHeaderStyle: React.CSSProperties = {
      fontSize: 12,
      color: '#6b7280',
      marginBottom: 8,
      fontWeight: 600,
    };
    const columnStyle: React.CSSProperties = {
      flex: '1 1 260px',
      minWidth: 0,
      maxWidth: '100%',
    };
    return (
      <div style={{ padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: 8, margin: 4 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            alignItems: 'flex-start',
          }}
        >
          <div style={columnStyle}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ ...sectionHeaderStyle, marginBottom: 0 }}>
                {t('details_checkin_info')}
                {isPastEntry ? (
                  <span style={{ ...pastEntryMetaStyle, marginLeft: 6 }}>({t('past_entry_badge')})</span>
                ) : null}
              </span>
            </div>
            <dl style={{ margin: 0, ...gridStyle } as React.CSSProperties}>
              <dt style={labelStyle}>{t('label_receipt')}</dt>
              <dd style={{ margin: 0, ...valueStyle }}>{formatReceiptNumber(checkin.receipt_number ?? '')}</dd>
              <dt style={labelStyle}>{t('label_room')}</dt>
              <dd style={{ margin: 0, ...valueStyle }}>{formatRoomDisplay(checkin.room_id, t('room'))}</dd>
              {isPastEntry ? (
                <>
                  <dt style={labelStyle}>{t('detail_employee_label')}</dt>
                  <dd style={{ margin: 0, ...valueStyle }}>{orDash(checkin.staff_name)}</dd>
                  <dt style={labelStyle}>{t('detail_checkin_at_label')}</dt>
                  <dd style={{ margin: 0, ...valueStyle }}>
                    {orDash(checkin.date)} {displayTime(checkin.time)}
                  </dd>
                  <dt style={labelStyle}>{t('detail_added_to_system')}</dt>
                  <dd style={{ margin: 0, ...valueStyle }}>
                    {orDash(checkin.past_entry_system_created_at)} {t('detail_added_by_admin')}
                  </dd>
                </>
              ) : (
                <>
                  <dt style={labelStyle}>{t('date')}</dt>
                  <dd style={{ margin: 0, ...valueStyle }}>{orDash(checkin.date)}</dd>
                  <dt style={labelStyle}>{t('time')}</dt>
                  <dd style={{ margin: 0, ...valueStyle }}>{displayTime(checkin.time)}</dd>
                  <dt style={labelStyle}>{t('label_staff_checkin')}</dt>
                  <dd style={{ margin: 0, ...valueStyle }}>{formatStaffDisplayForCheckinsTable(checkin)}</dd>
                </>
              )}
              <dt style={labelStyle}>{t('car_plate')}</dt>
              <dd style={{ margin: 0, ...valueStyle }}>{orDash(checkin.car_plate)}</dd>
              <dt style={labelStyle}>{t('payment_breakdown')}</dt>
              <dd style={{ margin: 0, ...valueStyle }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {pay.lines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </dd>
              <dt style={labelStyle}>{t('total_collected')}</dt>
              <dd style={{ margin: 0, ...valueStyle }}>${pay.total.toFixed(2)}</dd>
              {isPastEntry ? (
                <>
                  <dt style={labelStyle}>{t('receipts_captured_label')}</dt>
                  <dd style={{ margin: 0, ...valueStyle }}>{getEntryCount(checkin)}</dd>
                </>
              ) : null}
              <dt style={labelStyle}>{t('car_make')}</dt>
              <dd style={{ margin: 0, ...valueStyle }}>{orDash(checkin.car_make)}</dd>
              <dt style={labelStyle}>{t('car_color')}</dt>
              <dd style={{ margin: 0, ...valueStyle }}>
                {checkin.car_color ? carColorLabel(checkin.car_color, t) : '—'}
              </dd>
              <dt style={labelStyle}>{t('notes')}</dt>
              <dd style={{ margin: 0, ...valueStyle }}>{orDash(checkin.note)}</dd>
            </dl>
          </div>
          <div style={columnStyle}>
            <div style={sectionHeaderStyle}>{t('details_checkout_info')}</div>
            {isPastEntry ? (
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280', fontWeight: 500, lineHeight: 1.45 }}>
                {t('past_room_checkout_na')}
              </p>
            ) : hasCheckoutData ? (
              <dl style={{ margin: 0, ...gridStyle } as React.CSSProperties}>
                <dt style={labelStyle}>{t('label_checkout_time')}</dt>
                <dd style={{ margin: 0, ...valueStyle }}>{orDash(checkin.checked_out_at)}</dd>
                <dt style={labelStyle}>{t('label_cleaning_time')}</dt>
                <dd style={{ margin: 0, ...valueStyle }}>{orDash(checkin.cleaned_at)}</dd>
                <dt style={labelStyle}>{t('label_checked_out_by')}</dt>
                <dd style={{ margin: 0, ...valueStyle }}>
                  {formatGuestAwarePersonDisplay(checkin.checked_out_by, checkin)}
                </dd>
                <dt style={labelStyle}>{t('label_cleaned_by')}</dt>
                <dd style={{ margin: 0, ...valueStyle }}>
                  {formatGuestAwarePersonDisplay(checkin.cleaned_by, checkin)}
                </dd>
              </dl>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280', fontWeight: 500 }}>
                {t('not_checked_out_yet')}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const items = (checkin.summarizedItems ?? checkin.lineItems ?? []) as SummarizedItem[] | LineItem[];
  const itemsSummary =
    items.length > 0
      ? items
          .map((item: SummarizedItem | LineItem) => {
            const label = 'itemLabel' in item ? item.itemLabel : (item as LineItem).itemLabel;
            const q = 'totalQuantitySold' in item ? (item as SummarizedItem).totalQuantitySold : (item as LineItem).quantitySold;
            const a = 'totalAmountCollected' in item ? (item as SummarizedItem).totalAmountCollected : (item as LineItem).amountCollected;
            return `${label ?? item.itemId}: ${q} × $${Number(a).toFixed(2)}`;
          })
          .join('; ')
      : '—';

  const isPastFoodOrBeer = checkin.is_past_entry === true;

  return (
    <div style={{ padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: 8, margin: 4 }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, fontWeight: 600 }}>
        {checkin.checkInType === 'food' ? t('food_beverage_details') : t('beer_details')}
        {isPastFoodOrBeer ? (
          <span style={{ ...pastEntryMetaStyle, marginLeft: 6 }}>({t('past_entry_badge')})</span>
        ) : null}
      </div>
      <dl style={{ margin: 0, ...gridStyle } as React.CSSProperties}>
        <dt style={labelStyle}>{t('table_staff')}</dt>
        <dd style={{ margin: 0, ...valueStyle }}>{formatStaffDisplayForCheckinsTable(checkin)}</dd>
        {isPastFoodOrBeer ? (
          <>
            <dt style={labelStyle}>{t('date')}</dt>
            <dd style={{ margin: 0, ...valueStyle }}>{orDash(checkin.date)}</dd>
            <dt style={labelStyle}>{t('time')}</dt>
            <dd style={{ margin: 0, ...valueStyle }}>{displayTime(checkin.time)}</dd>
          </>
        ) : null}
        <dt style={labelStyle}>{t('payment_method')}</dt>
        <dd style={{ margin: 0, ...valueStyle }}>
          {checkin.payment_splits && checkin.payment_splits.length > 0
            ? getRoomPaymentBreakdownDisplayLocalized(checkin, (k) => t(k as TranslationKey)).compactComma
            : hasStoredPaymentMethodSingle(checkin.payment_method)
              ? t(getPaymentMethodTranslationKey(checkin.payment_method) as TranslationKey)
              : t('payment_method_not_recorded')}
        </dd>
        <dt style={labelStyle}>{t('items')}</dt>
        <dd style={{ margin: 0, ...valueStyle }}>{itemsSummary}</dd>
        <dt style={labelStyle}>{t('total')}</dt>
        <dd style={{ margin: 0, ...valueStyle }}>${Number(checkin.cost).toFixed(2)}</dd>
        {isPastFoodOrBeer ? (
          <>
            <dt style={labelStyle}>{t('receipts_captured_label')}</dt>
            <dd style={{ margin: 0, ...valueStyle }}>{getEntryCount(checkin)}</dd>
          </>
        ) : null}
        <dt style={labelStyle}>{t('notes')}</dt>
        <dd style={{ margin: 0, ...valueStyle }}>{orDash(checkin.note)}</dd>
        {isPastFoodOrBeer ? (
          <>
            <dt style={labelStyle}>{t('detail_added_to_system')}</dt>
            <dd style={{ margin: 0, ...valueStyle }}>
              {orDash(checkin.past_entry_system_created_at)} {t('detail_added_by_admin')}
            </dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}

export default function CheckinsList({
  initialCheckins,
  initialStartDate,
  initialEndDate,
  todayISO,
  rangeError: initialRangeError,
  rangeOverview = null,
  role,
  viewingAll = false,
}: {
  initialCheckins: CheckIn[];
  /** Applied Puerto Rico start date (YYYY-MM-DD). */
  initialStartDate: string;
  /** Applied Puerto Rico end date (YYYY-MM-DD). */
  initialEndDate: string;
  /** Today's calendar date in America/Puerto_Rico (server-computed). */
  todayISO: string;
  /** Server-side range validation failure — query was not executed. */
  rangeError?: ViewCheckinsDateRangeErrorCode;
  /** Multi-day summary-first overview (persisted daily summaries — no raw rows). */
  rangeOverview?: ViewCheckinsRangeOverview | null;
  role?: UserRole;
  /** Explicit `?all=1` unfiltered newest-created view — not the default View Check-ins path. */
  viewingAll?: boolean;
}) {
  const RECORDS_PER_PAGE = 10;
  const router = useRouter();
  const { t, language } = useLanguage();
  const [selectedStartDate, setSelectedStartDate] = useState(initialStartDate);
  const [selectedEndDate, setSelectedEndDate] = useState(initialEndDate);
  const [filterValidationError, setFilterValidationError] = useState<ViewCheckinsDateRangeErrorCode | null>(
    initialRangeError ?? null
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingCheckin, setEditingCheckin] = useState<CheckIn | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<{ checkin: CheckIn; draft: EditCheckinDraft } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CheckIn | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editStaffOptions, setEditStaffOptions] = useState<string[] | undefined>(undefined);
  /** Multi-day: only one day of raw records expanded at a time. */
  const [expandedRecordsDate, setExpandedRecordsDate] = useState<string | null>(null);
  const [dayRecordsCache, setDayRecordsCache] = useState<Record<string, CheckIn[]>>({});
  const [loadingRecordsDate, setLoadingRecordsDate] = useState<string | null>(null);
  const [recordsLoadError, setRecordsLoadError] = useState<string | null>(null);

  const isAdmin = role === 'admin';
  const colCount = 9;
  const toggleExpanded = (checkin: CheckIn) => {
    const id = stableCheckinRowId(checkin);
    setExpandedId((prev) => (prev === id ? null : id));
  };

  useEffect(() => {
    setSelectedStartDate(initialStartDate);
    setSelectedEndDate(initialEndDate);
    setFilterValidationError(initialRangeError ?? null);
    setExpandedRecordsDate(null);
    setDayRecordsCache({});
    setRecordsLoadError(null);
  }, [initialStartDate, initialEndDate, initialRangeError, rangeOverview]);

  useEffect(() => {
    setCurrentPage(1);
  }, [initialStartDate, initialEndDate, initialCheckins, rangeOverview]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/checkins/checkout-staff-options', { credentials: 'include' });
        if (!res.ok) return;
        const data = (await res.json()) as { names?: string[] };
        if (!cancelled && Array.isArray(data.names)) setEditStaffOptions(data.names);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const dateFilterActive =
    !viewingAll &&
    !initialRangeError &&
    /^\d{4}-\d{2}-\d{2}$/.test(initialStartDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(initialEndDate);
  const isSingleDay = dateFilterActive && initialStartDate === initialEndDate;
  const isMultiDay = dateFilterActive && initialStartDate !== initialEndDate && rangeOverview != null;
  const isSpecificDateSelected = isSingleDay;
  const canClearFilters =
    viewingAll ||
    initialStartDate !== todayISO ||
    initialEndDate !== todayISO ||
    Boolean(initialRangeError);

  const navigateToDateRange = useCallback(
    (startISO: string, endISO: string) => {
      setSelectedStartDate(startISO);
      setSelectedEndDate(endISO);
      setFilterValidationError(null);
      if (startISO === endISO) {
        router.push(`/checkins?date=${encodeURIComponent(startISO)}`);
      } else {
        router.push(
          `/checkins?start_date=${encodeURIComponent(startISO)}&end_date=${encodeURIComponent(endISO)}`
        );
      }
    },
    [router]
  );

  const navigateToToday = useCallback(() => {
    navigateToDateRange(todayISO, todayISO);
  }, [navigateToDateRange, todayISO]);

  const handleFilter = () => {
    const start = selectedStartDate.trim();
    const end = selectedEndDate.trim();
    const validation = validateViewCheckinsDateRange(start, end, todayISO);
    if (!validation.ok) {
      setFilterValidationError(validation.code);
      return;
    }
    navigateToDateRange(validation.startISO, validation.endISO);
  };

  const handleClearFilters = () => {
    setFilterValidationError(null);
    navigateToToday();
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (dateFilterActive) {
      if (isSingleDay) {
        params.set('date', initialStartDate);
      } else {
        params.set('start_date', initialStartDate);
        params.set('end_date', initialEndDate);
      }
    } else {
      const start = selectedStartDate.trim();
      const end = selectedEndDate.trim();
      const validation = validateViewCheckinsDateRange(start, end, todayISO);
      if (!validation.ok) {
        setFilterValidationError(validation.code);
        return;
      }
      if (validation.startISO === validation.endISO) {
        params.set('date', validation.startISO);
      } else {
        params.set('start_date', validation.startISO);
        params.set('end_date', validation.endISO);
      }
    }
    window.location.href = `/export?${params.toString()}`;
  };

  const goToPreviousDay = () => {
    if (!isSingleDay) return;
    const prev = addDaysToISODate(initialStartDate, -1);
    if (prev) navigateToDateRange(prev, prev);
  };

  const goToNextDay = () => {
    if (!isSingleDay || isISODateTodayInPR(initialStartDate)) return;
    const next = addDaysToISODate(initialStartDate, 1);
    if (next) navigateToDateRange(next, next);
  };

  const isSelectedDateToday = () => (isSingleDay ? isISODateTodayInPR(initialStartDate) : false);

  const formatSelectedDateLabel = () =>
    isSingleDay ? formatISODateLabel(initialStartDate, language) : '';

  const formatRangeStartLabel = () => formatISODateLabel(initialStartDate, language);
  const formatRangeEndLabel = () => formatISODateLabel(initialEndDate, language);

  const handleDeleteClick = (checkin: CheckIn) => {
    setErrorMessage(null);
    setPendingDelete(checkin);
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete?.id) return;
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/checkins/${pendingDelete.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data?.message === 'string' ? data.message : t('error_delete_failed'));
      }
      setPendingDelete(null);
      setSuccessMessage(t('success_checkin_deleted'));
      if (pendingDelete.date) invalidateDayRecordsCache(pendingDelete.date);
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('error_delete_failed'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    if (!isDeleting) {
      setPendingDelete(null);
      setErrorMessage(null);
    }
  };

  function storedCheckInKind(c: CheckIn): CheckInType {
    return c.checkInType === 'food' || c.checkInType === 'beer' ? c.checkInType : 'room';
  }

  function draftFoodBeerLineItems(draft: EditCheckinDraft): LineItem[] {
    if (draft.lineItems && draft.lineItems.length > 0) return draft.lineItems;
    if (draft.itemId?.trim()) {
      return [
        {
          itemId: draft.itemId,
          itemLabel: (draft.itemLabel ?? draft.itemId).trim(),
          quantitySold: draft.quantity ?? 0,
          amountCollected: Number(draft.amountCollected) ?? 0,
        },
      ];
    }
    return [];
  }

  function buildDiffLines(checkin: CheckIn, draft: EditCheckinDraft): DiffLine[] {
    const lines: DiffLine[] = [];
    const origKind = storedCheckInKind(checkin);

    const fromDt = `${checkin.date ?? ''} ${checkin.time ?? ''}`.trim();
    const toDt = `${draft.check_in_date ?? ''} ${draft.check_in_time ?? ''}`.trim();
    if (fromDt !== toDt) {
      lines.push({
        label: t('diff_label_checkin_datetime'),
        from: fromDt || '—',
        to: toDt || '—',
      });
    }

    const noteFrom = (checkin.note ?? '').trim();
    const noteTo = draft.note.trim();
    if (noteFrom !== noteTo) {
      lines.push({
        label: t('diff_label_notes'),
        from: noteFrom || '—',
        to: noteTo || '—',
      });
    }

    if (draft.staff_name !== (checkin.staff_name ?? '')) {
      lines.push({ label: t('diff_label_staff'), from: checkin.staff_name ?? '', to: draft.staff_name });
    }
    if (checkin.is_past_entry === true) {
      const fromRc = checkin.receipts_captured != null ? String(checkin.receipts_captured) : '1';
      const toRc =
        draft.receipts_captured != null && draft.receipts_captured !== undefined
          ? String(draft.receipts_captured)
          : '1';
      if (fromRc !== toRc) {
        lines.push({
          label: t('diff_label_receipts_captured'),
          from: fromRc,
          to: toRc,
        });
      }
    }

    if (origKind === 'room') {
      const receiptFrom = formatReceiptNumber(checkin.receipt_number ?? '');
      const receiptTo = draft.receipt_number ?? '';
      if (receiptTo !== receiptFrom) {
        lines.push({
          label: t('diff_label_receipt'),
          from: receiptFrom,
          to: receiptTo,
        });
      }
      const fromPay = getRoomPaymentBreakdownDisplayLocalized(checkin, (k) => t(k as TranslationKey));
      const toSplits = draft.payment_splits;
      if (toSplits && toSplits.length > 0) {
        const toBreakdown = toSplits
          .map(
            (s) =>
              `${t(getPaymentMethodTranslationKey(s.method) as TranslationKey)} $${Number(s.amount).toFixed(2)}`
          )
          .join(', ');
        const toTotal = calculatePaymentSplitTotal(toSplits);
        if (fromPay.compactComma !== toBreakdown) {
          lines.push({
            label: t('diff_label_payment_breakdown'),
            from: fromPay.compactComma,
            to: toBreakdown,
          });
        }
        if (fromPay.total !== toTotal) {
          lines.push({
            label: t('diff_label_total_collected'),
            from: `$${fromPay.total.toFixed(2)}`,
            to: `$${toTotal.toFixed(2)}`,
          });
        }
      }
      if (draft.room_id != null && String(draft.room_id) !== String(checkin.room_id ?? '')) {
        lines.push({
          label: t('diff_label_room'),
          from: String(checkin.room_id ?? ''),
          to: String(draft.room_id),
        });
      }
      return lines;
    }

    const fromLines = lineItemsFromCheckinRecord(checkin);
    const toLines = draftFoodBeerLineItems(draft);

    const fromItemsSummary = foodBeerLineRowsSummary(fromLines);
    const toItemsSummary = foodBeerLineRowsSummary(toLines);
    if (fromItemsSummary !== toItemsSummary) {
      lines.push({
        label: t('items'),
        from: fromItemsSummary || '—',
        to: toItemsSummary || '—',
      });
    }

    const fromTot = foodBeerLineRowsAmountTotal(fromLines);
    const toTot = foodBeerLineRowsAmountTotal(toLines);
    if (fromTot !== toTot) {
      lines.push({
        label: t('total'),
        from: `$${fromTot.toFixed(2)}`,
        to: `$${toTot.toFixed(2)}`,
      });
    }

    const fromPay = getRoomPaymentBreakdownDisplayLocalized(checkin, (k) => t(k as TranslationKey));
    const toSplits = draft.payment_splits;
    if (toSplits && toSplits.length > 0) {
      const toBreakdown = toSplits
        .map(
          (s) =>
            `${t(getPaymentMethodTranslationKey(s.method) as TranslationKey)} $${Number(s.amount).toFixed(2)}`
        )
        .join(', ');
      if (fromPay.compactComma !== toBreakdown) {
        lines.push({
          label: t('diff_label_payment_breakdown'),
          from: fromPay.compactComma,
          to: toBreakdown,
        });
      }
    } else {
      const fromPm = hasStoredPaymentMethodSingle(checkin.payment_method)
        ? String(checkin.payment_method).trim()
        : '';
      const toPm = draft.payment_method?.trim() ?? '';
      if (toPm !== fromPm) {
        const fromPmLabel = fromPm
          ? t(getPaymentMethodTranslationKey(fromPm) as TranslationKey)
          : t('payment_method_not_recorded');
        const toPmLabel = toPm
          ? t(getPaymentMethodTranslationKey(toPm) as TranslationKey)
          : t('payment_method_not_recorded');
        lines.push({
          label: t('diff_label_payment_method'),
          from: fromPmLabel,
          to: toPmLabel,
        });
      }
    }
    return lines;
  }

  const handleEditSave = (draft: EditCheckinDraft) => {
    if (!editingCheckin) return;
    const diffLines = buildDiffLines(editingCheckin, draft);
    if (diffLines.length === 0) return;
    setPendingUpdate({ checkin: editingCheckin, draft });
    setEditingCheckin(null);
  };

  const handleConfirmUpdate = async () => {
    if (!pendingUpdate?.checkin.id) return;
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/checkins/${pendingUpdate.checkin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          checkInType: storedCheckInKind(pendingUpdate.checkin),
          check_in_date: pendingUpdate.draft.check_in_date,
          check_in_time: pendingUpdate.draft.check_in_time,
          note: pendingUpdate.draft.note,
          staff_name: pendingUpdate.draft.staff_name,
          ...(pendingUpdate.checkin.is_past_entry === true
            ? { receipts_captured: pendingUpdate.draft.receipts_captured ?? null }
            : {}),
          ...(storedCheckInKind(pendingUpdate.checkin) === 'room'
            ? {
                receipt_number: pendingUpdate.draft.receipt_number,
                room_id: pendingUpdate.draft.room_id,
                payment_splits: pendingUpdate.draft.payment_splits,
              }
            : {
                lineItems: draftFoodBeerLineItems(pendingUpdate.draft),
                payment_method: pendingUpdate.draft.payment_method,
                payment_splits: pendingUpdate.draft.payment_splits,
              }),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          typeof data?.error === 'string'
            ? data.error
            : typeof data?.message === 'string'
              ? data.message
              : t('error_update_failed');
        throw new Error(msg);
      }
      setPendingUpdate(null);
      setEditingCheckin(null);
      setSuccessMessage(t('success_record_updated'));
      const affectedDates = [
        pendingUpdate.checkin.date,
        pendingUpdate.draft.check_in_date,
      ].filter(Boolean) as string[];
      for (const d of [...new Set(affectedDates)]) invalidateDayRecordsCache(d);
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('error_update_failed'));
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(t);
  }, [successMessage]);

  const totalPages = Math.max(1, Math.ceil(initialCheckins.length / RECORDS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * RECORDS_PER_PAGE;
  const visibleCheckins = isSpecificDateSelected
    ? initialCheckins
    : initialCheckins.slice(pageStart, pageStart + RECORDS_PER_PAGE);
  const showPagination = !isSpecificDateSelected && totalPages > 1;

  const sectioned = useMemo(() => {
    if (!isSingleDay || initialCheckins.length === 0) return null;
    return buildSectionedData(initialCheckins);
  }, [isSingleDay, initialCheckins]);

  /** Same loaded day records as Day total — no extra fetch. */
  const dayPaymentTotals = useMemo(() => {
    if (!isSingleDay || initialCheckins.length === 0) return [];
    return paymentMethodTotalsToCents(initialCheckins);
  }, [isSingleDay, initialCheckins]);

  const filteredDayEmpty = isSingleDay && initialCheckins.length === 0;
  const validationMessage = filterValidationError
    ? t(viewCheckinsDateRangeErrorTranslationKey(filterValidationError))
    : null;

  const invalidateDayRecordsCache = useCallback((businessDate: string) => {
    setDayRecordsCache((prev) => {
      if (!(businessDate in prev)) return prev;
      const next = { ...prev };
      delete next[businessDate];
      return next;
    });
  }, []);

  const handleViewRecordsToggle = useCallback(
    async (businessDate: string) => {
      if (expandedRecordsDate === businessDate) {
        setExpandedRecordsDate(null);
        setRecordsLoadError(null);
        return;
      }

      setRecordsLoadError(null);
      setExpandedRecordsDate(businessDate);

      if (dayRecordsCache[businessDate]) return;

      setLoadingRecordsDate(businessDate);
      try {
        const res = await fetch(
          `/api/admin/checkins/day-records?date=${encodeURIComponent(businessDate)}`,
          { credentials: 'include' }
        );
        if (!res.ok) {
          throw new Error(t('list_records_load_error'));
        }
        const data = (await res.json()) as { checkins?: CheckIn[] };
        setDayRecordsCache((prev) => ({
          ...prev,
          [businessDate]: Array.isArray(data.checkins) ? data.checkins : [],
        }));
      } catch (err) {
        setRecordsLoadError(err instanceof Error ? err.message : t('list_records_load_error'));
        setExpandedRecordsDate(null);
      } finally {
        setLoadingRecordsDate(null);
      }
    },
    [dayRecordsCache, expandedRecordsDate, t]
  );

  const renderActionsCell = (checkin: CheckIn) => {
    const rowId = stableCheckinRowId(checkin);
    const isExpanded = expandedId === rowId;
    return (
      <td
        className="checkins-col-actions"
        style={{
          padding: '8px 6px',
        }}
      >
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => toggleExpanded(checkin)}
            className="btn btn-ghost"
            style={{ minWidth: 32, height: 32, padding: 0 }}
            aria-label={isExpanded ? t('aria_hide_details') : t('aria_view_details')}
            title={isExpanded ? t('aria_hide_details') : t('aria_view_details')}
          >
            {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </button>
          {isAdmin && checkin.id && (
            <>
              <button
                type="button"
                onClick={() => setEditingCheckin(checkin)}
                className="btn btn-ghost"
                style={{ minWidth: 32, height: 32, padding: 0 }}
                aria-label={t('aria_edit_checkin')}
                title={t('aria_edit_checkin')}
              >
                <EditIcon />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteClick(checkin)}
                className="btn btn-ghost"
                style={{ minWidth: 32, height: 32, padding: 0 }}
                aria-label={t('aria_delete_checkin')}
                title={t('aria_delete_checkin')}
              >
                <TrashIcon />
              </button>
            </>
          )}
        </div>
      </td>
    );
  };

  const renderCheckinDataRows = (checkin: CheckIn) => (
    <Fragment key={stableCheckinRowId(checkin)}>
      <tr>
        <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>{receiptCell(checkin)}</td>
        <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>{checkin.date}</td>
        <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>{displayTime(checkin.time)}</td>
        <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>{typeCell(checkin, t)}</td>
        <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>{roomCell(checkin, t)}</td>
        <td
          style={{
            padding: '8px 6px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={formatStaffDisplayForCheckinsTable(checkin)}
        >
          {formatStaffDisplayForCheckinsTable(checkin)}
        </td>
        <td style={{ padding: '8px 6px', verticalAlign: 'middle' }}>
          <PaymentMethodTags checkin={checkin} t={t} />
        </td>
        <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>
          ${Number(checkin.cost).toFixed(2)}
        </td>
        {renderActionsCell(checkin)}
      </tr>
      {expandedId === stableCheckinRowId(checkin) && (
        <tr>
          <td colSpan={colCount} style={{ padding: 0, borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' }}>
            <div className="checkin-expanded-grid">
              <div style={{ minWidth: 0 }}>
                <DetailsPanel checkin={checkin} t={t} />
              </div>
              <div style={{ minWidth: 0 }}>
                <EditHistoryPanel checkinId={checkin.id ?? ''} checkin={checkin} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );

  const renderSectionedDayBody = (
    daySectioned: NonNullable<typeof sectioned>,
    options: {
      dateISO?: string;
      showPaymentTotals?: boolean;
      paymentTotals?: ReturnType<typeof paymentMethodTotalsToCents>;
    } = {}
  ) => {
    const { dateISO, showPaymentTotals = false, paymentTotals = [] } = options;
    return (
      <>
        {dateISO && (
          <tr style={{ backgroundColor: '#eef2ff' }}>
            <td colSpan={colCount} style={{ padding: '10px 8px', fontWeight: 700, fontSize: 15, color: '#1e3a5f' }}>
              {formatISODateLabel(dateISO, language)}
            </td>
          </tr>
        )}
        {SECTION_BUCKET_KEYS.map((labelKey, idx) => (
          <Fragment key={`${dateISO ?? 'day'}-${idx}`}>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <td colSpan={colCount} style={{ padding: 8, fontWeight: 600 }}>
                {t(labelKey)}
              </td>
            </tr>
            {daySectioned.buckets[idx].map((checkin) => renderCheckinDataRows(checkin))}
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <td colSpan={colCount} style={{ padding: '8px 10px', textAlign: 'right' }}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'flex-end',
                    alignItems: 'baseline',
                    gap: '4px 12px',
                    maxWidth: '100%',
                  }}
                >
                  <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{t('list_section_total')}</span>
                  {renderTotalsBreakdown(daySectioned.sectionTotals[idx], t)}
                </div>
              </td>
            </tr>
          </Fragment>
        ))}
        <tr style={{ backgroundColor: '#e5e7eb', fontWeight: 600 }}>
          <td colSpan={colCount} style={{ padding: '8px 10px', textAlign: 'right' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
                alignItems: 'baseline',
                gap: '4px 12px',
                maxWidth: '100%',
              }}
            >
              <span style={{ whiteSpace: 'nowrap' }}>{t('list_day_total')}</span>
              {renderTotalsBreakdown(daySectioned.dayTotals, t)}
            </div>
          </td>
        </tr>
        {showPaymentTotals && (
          <tr style={{ backgroundColor: '#e5e7eb' }}>
            <td colSpan={colCount} style={{ padding: '2px 10px 10px', textAlign: 'right' }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, color: '#4b5563' }}>
                {t('employee_recent_payment_totals_heading')}
              </div>
              {paymentTotals.length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'flex-end',
                    gap: '4px 12px',
                    fontSize: 12,
                    lineHeight: 1.65,
                    fontWeight: 500,
                    color: '#1f2937',
                    maxWidth: '100%',
                  }}
                >
                  {paymentTotals.map(({ method, cents }) => (
                    <span key={method} style={{ whiteSpace: 'nowrap' }}>
                      {method === 'unspecified'
                        ? t('employee_recent_payment_method_unspecified')
                        : t(getPaymentMethodTranslationKey(method) as TranslationKey)}
                      : {centsToCurrency(cents)}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.65, color: '#6b7280', fontWeight: 400 }}>
                  {t('employee_recent_payment_totals_empty')}
                </p>
              )}
            </td>
          </tr>
        )}
      </>
    );
  };

  const tableBody = () => {
    if (sectioned) {
      return renderSectionedDayBody(sectioned, {
        showPaymentTotals: true,
        paymentTotals: dayPaymentTotals,
      });
    }
    return visibleCheckins.map((checkin) => renderCheckinDataRows(checkin));
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="card checkins-filter-card">
        <strong>{t('list_filter_by_date')}</strong>
        <div className="checkins-filter-row">
          <label className="checkins-filter-field">
            <div>{t('list_start_date')}</div>
            <input
              type="date"
              className="checkins-filter-date-input"
              value={selectedStartDate}
              max={todayISO}
              onChange={(e) => {
                setSelectedStartDate(e.target.value);
                setFilterValidationError(null);
              }}
            />
          </label>
          <label className="checkins-filter-field">
            <div>{t('list_end_date')}</div>
            <input
              type="date"
              className="checkins-filter-date-input"
              value={selectedEndDate}
              max={todayISO}
              onChange={(e) => {
                setSelectedEndDate(e.target.value);
                setFilterValidationError(null);
              }}
            />
          </label>
          <div className="checkins-filter-actions">
            <Button variant="primary" onClick={handleFilter}>
              {t('list_filter')}
            </Button>
            <Button variant="ghost" onClick={handleClearFilters} disabled={!canClearFilters}>
              {t('list_clear_filters')}
            </Button>
            <Button variant="secondary" onClick={handleExport}>
              {t('export_csv')}
            </Button>
          </div>
        </div>
        {validationMessage && (
          <div role="alert" style={{ fontSize: 14, color: '#991b1b' }}>
            {validationMessage}
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="card" style={{ padding: 12, backgroundColor: '#fef2f2', color: '#991b1b' }}>
          {errorMessage}
        </div>
      )}
      {successMessage && !errorMessage && (
        <div className="card" style={{ padding: 12, backgroundColor: '#f0fdf4', color: '#166534' }}>
          {successMessage}
        </div>
      )}

      {isMultiDay && rangeOverview && (
        <>
          <div
            className="card"
            style={{
              backgroundColor: '#dbeafe',
              fontWeight: 700,
              padding: '12px 10px',
              borderTop: '2px solid #93c5fd',
              textAlign: 'right',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
                alignItems: 'baseline',
                gap: '4px 12px',
                maxWidth: '100%',
              }}
            >
              <span style={{ whiteSpace: 'nowrap', fontSize: 14 }}>{t('list_selected_range_total')}</span>
              {renderTotalsBreakdown(rangeOverview.rangeTotals, t)}
            </div>
          </div>

          <p style={{ margin: 0, textAlign: 'center', fontSize: 15, fontWeight: 500, color: '#374151' }}>
            {t('list_showing_checkins_for_range', {
              start: formatRangeStartLabel(),
              end: formatRangeEndLabel(),
            })}
          </p>

          {recordsLoadError && (
            <div className="card" style={{ padding: 12, backgroundColor: '#fef2f2', color: '#991b1b' }}>
              {recordsLoadError}
            </div>
          )}

          {rangeOverview.days.map((day) => {
            const isExpanded = expandedRecordsDate === day.businessDate;
            const isLoading = loadingRecordsDate === day.businessDate;
            const dayRows = dayRecordsCache[day.businessDate];
            const daySectioned =
              isExpanded && dayRows != null ? buildSectionedData(dayRows) : null;

            const recordsToggle = (
              <div>
                <Button
                  variant="secondary"
                  onClick={() => void handleViewRecordsToggle(day.businessDate)}
                  disabled={isLoading}
                >
                  {isLoading
                    ? t('list_loading_records')
                    : isExpanded
                      ? t('list_hide_records')
                      : t('list_view_records')}
                </Button>
              </div>
            );

            const renderShiftRecordsTable = (bucketRows: CheckIn[]) => (
              <div className="checkins-table-scroll">
                <table className="checkins-table checkins-table--admin">
                  <colgroup>
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '104px' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      {(
                        [
                          'table_receipt',
                          'date',
                          'time',
                          'table_type',
                          'table_room',
                          'table_staff',
                          'payment_method',
                          'table_total',
                        ] as const
                      ).map((h) => (
                        <th
                          key={h}
                          style={{
                            whiteSpace: h === 'payment_method' ? 'normal' : 'nowrap',
                          }}
                        >
                          {t(h)}
                        </th>
                      ))}
                      <th className="checkins-col-actions" style={{ whiteSpace: 'nowrap' }}>
                        {t('table_actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>{bucketRows.map((checkin) => renderCheckinDataRows(checkin))}</tbody>
                </table>
              </div>
            );

            return (
              <div key={day.businessDate} className="card" style={{ display: 'grid', gap: 12 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    color: '#1e3a5f',
                    paddingBottom: 4,
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  {formatISODateLabel(day.businessDate, language)}
                </div>

                {day.empty ? (
                  <p style={{ margin: 0, color: '#6b7280' }}>{t('list_day_no_checkins')}</p>
                ) : (
                  <>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('list_day_total')}</div>
                      {renderTotalsBreakdown(day.dayTotals, t)}
                    </div>

                    {isExpanded ? (
                      <>
                        {recordsToggle}
                        {SECTION_BUCKET_KEYS.map((labelKey, idx) => {
                          const bucketRows = daySectioned?.buckets[idx] ?? [];
                          const shiftTotals = day.sectionTotals[idx]!;
                          return (
                            <div
                              key={labelKey}
                              style={{
                                display: 'grid',
                                gap: 8,
                                padding: '10px 0',
                                borderTop: '1px solid #e5e7eb',
                              }}
                            >
                              <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>
                                {t(labelKey)}
                              </div>
                              {bucketRows.length === 0 ? (
                                <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                                  {t('list_no_records_for_shift')}
                                </p>
                              ) : (
                                renderShiftRecordsTable(bucketRows)
                              )}
                              <div
                                style={{
                                  padding: '8px 10px',
                                  backgroundColor: '#f3f4f6',
                                  borderRadius: 8,
                                  textAlign: 'right',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    justifyContent: 'flex-end',
                                    alignItems: 'baseline',
                                    gap: '4px 12px',
                                  }}
                                >
                                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    {t('list_shift_total')}
                                  </span>
                                  {renderTotalsBreakdown(shiftTotals, t)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    ) : (
                      <>
                        {SECTION_BUCKET_KEYS.map((labelKey, idx) => (
                          <div
                            key={labelKey}
                            style={{
                              padding: '8px 10px',
                              backgroundColor: '#f9fafb',
                              borderRadius: 8,
                              textAlign: 'right',
                            }}
                          >
                            <div style={{ fontWeight: 600, marginBottom: 4, textAlign: 'left' }}>
                              {t(labelKey)}
                            </div>
                            {renderTotalsBreakdown(day.sectionTotals[idx]!, t)}
                          </div>
                        ))}
                        {recordsToggle}
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </>
      )}

      {!isMultiDay && (
      <div className="card">
        <div className="checkins-table-scroll">
        <table className="checkins-table checkins-table--admin">
          <colgroup>
            <col style={{ width: '7%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '104px' }} />
          </colgroup>
          <thead>
            <tr>
              {(
                [
                  'table_receipt',
                  'date',
                  'time',
                  'table_type',
                  'table_room',
                  'table_staff',
                  'payment_method',
                  'table_total',
                ] as const
              ).map((h) => (
                <th
                  key={h}
                  style={{
                    whiteSpace: h === 'payment_method' ? 'normal' : 'nowrap',
                  }}
                >
                  {t(h)}
                </th>
              ))}
              <th key="actions" className="checkins-col-actions" style={{ whiteSpace: 'nowrap' }}>
                {t('table_actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredDayEmpty ? (
              <tr>
                <td colSpan={colCount} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                  {t('list_no_checkins_for_day')}
                </td>
              </tr>
            ) : (
              tableBody()
            )}
          </tbody>
        </table>
        </div>
        {!dateFilterActive && initialCheckins.length === 0 && (
          <div style={{ padding: 16 }}>{t('list_no_checkins')}</div>
        )}
        {isSingleDay && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: 12,
              padding: '12px 8px 8px',
              borderTop: '1px solid #e5e7eb',
            }}
            className="checkins-day-nav"
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <Button variant="secondary" className="btn-pastel-prev" onClick={goToPreviousDay}>
                {t('list_previous_day')}
              </Button>
              <p
                style={{
                  margin: 0,
                  flex: '1 1 auto',
                  textAlign: 'center',
                  fontSize: 15,
                  fontWeight: 500,
                  color: '#374151',
                  minWidth: 200,
                }}
              >
                {t('list_showing_checkins_for', { date: formatSelectedDateLabel() })}
              </p>
              <Button
                variant="secondary"
                className="btn-pastel-next"
                onClick={goToNextDay}
                disabled={isSelectedDateToday()}
              >
                {t('list_next_day')}
              </Button>
            </div>
          </div>
        )}
      </div>
      )}
      {showPagination && (
        <div
          className="card"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
        >
          <Button
            variant="ghost"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safeCurrentPage <= 1}
          >
            Previous
          </Button>
          <div style={{ fontSize: 14, color: '#374151' }}>
            Page {safeCurrentPage} of {totalPages}
          </div>
          <Button
            variant="ghost"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safeCurrentPage >= totalPages}
          >
            Next
          </Button>
        </div>
      )}

      <EditCheckinModal
        open={!!editingCheckin}
        onOpenChange={(open) => !open && setEditingCheckin(null)}
        checkin={editingCheckin}
        onSave={handleEditSave}
        saveDisabled={isUpdating}
        staffOptions={editStaffOptions}
      />
      <ConfirmDiffModal
        open={!!pendingUpdate}
        onOpenChange={(open) => !open && setPendingUpdate(null)}
        diffLines={pendingUpdate ? buildDiffLines(pendingUpdate.checkin, pendingUpdate.draft) : []}
        onConfirm={handleConfirmUpdate}
        isSubmitting={isUpdating}
      />
      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-checkin-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.4)',
          }}
          onClick={handleDeleteCancel}
        >
          <div
            className="card"
            style={{ minWidth: 320, maxWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-checkin-title" style={{ margin: '0 0 8px', fontSize: 18 }}>
              {t('delete_checkin_title')}
            </h2>
            <p style={{ margin: '0 0 16px', color: '#6b7280' }}>{t('delete_irreversible_body')}</p>
            <dl style={{ margin: '0 0 20px', fontSize: 14 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <dt style={{ fontWeight: 500 }}>{t('label_receipt')}</dt>
                <dd style={{ margin: 0 }}>{formatReceiptNumber(pendingDelete.receipt_number ?? '')}</dd>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <dt style={{ fontWeight: 500 }}>{t('date')}</dt>
                <dd style={{ margin: 0 }}>{pendingDelete.date}</dd>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <dt style={{ fontWeight: 500 }}>{t('time')}</dt>
                <dd style={{ margin: 0 }}>{displayTime(pendingDelete.time)}</dd>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <dt style={{ fontWeight: 500 }}>{t('label_room')}</dt>
                <dd style={{ margin: 0 }}>{formatRoomDisplay(pendingDelete.room_id, t('room'))}</dd>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <dt style={{ fontWeight: 500 }}>{t('table_total')}</dt>
                <dd style={{ margin: 0 }}>${Number(pendingDelete.cost).toFixed(2)}</dd>
              </div>
            </dl>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={handleDeleteCancel} disabled={isDeleting}>
                {t('cancel')}
              </Button>
              <Button variant="primary" onClick={handleDeleteConfirm} disabled={isDeleting}>
                {isDeleting ? t('deleting') : t('delete_checkin_confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
