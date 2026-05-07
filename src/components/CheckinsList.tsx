'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CheckIn, UserRole, LineItem, SummarizedItem } from '@/types';
import Button from '@/components/Button';
import { buildSectionedData, type SectionTotals } from '@/lib/checkins/sectioning';
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
import { getPaymentMethodTranslationKey } from '@/lib/checkins/paymentMethods';
import {
  formatGuestAwarePersonDisplay,
  formatStaffDisplayForCheckinsTable,
} from '@/lib/checkins/staffDisplay';

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
    <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
      {t('list_totals_cars')}: {carCount} | {t('list_totals_room')}: {centsToCurrency(totals.roomCents)} |{' '}
      {t('list_totals_food')}: {centsToCurrency(totals.foodCents)} | {t('list_totals_beer')}:{' '}
      {centsToCurrency(totals.beerCents)} |{' '}
      <strong>
        {t('list_totals_label')}: {centsToCurrency(totals.totalCents)}
      </strong>
    </span>
  );
}

export type { SectionTotals } from '@/lib/checkins/sectioning';

const SECTION_BUCKET_KEYS: TranslationKey[] = ['section_bucket_1', 'section_bucket_2', 'section_bucket_3'];

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

/** Firestore-backed rows always have `id`; avoid receipt-only keys so duplicate receipts stay distinct in the UI. */
function stableCheckinRowId(c: CheckIn): string {
  if (c.id) return c.id;
  return `legacy:${c.receipt_number}:${c.date}:${c.time}:${String(c.room_id)}:${c.cost}`;
}

function PastEntryTypeChip({ t }: { t: (key: TranslationKey) => string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 600,
        padding: '4px 10px',
        borderRadius: 9999,
        background: '#fef3c7',
        color: '#92400e',
        border: '1px solid #fcd34d',
        lineHeight: 1.2,
        verticalAlign: 'middle',
      }}
    >
      {t('past_entry_badge')}
    </span>
  );
}

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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
              }}
            >
              {isPastEntry ? (
                <span
                  title={t('past_entry_badge')}
                  aria-hidden
                  style={{
                    width: 4,
                    alignSelf: 'stretch',
                    minHeight: 14,
                    borderRadius: 2,
                    background: '#f59e0b',
                    flexShrink: 0,
                  }}
                />
              ) : null}
              <span style={{ ...sectionHeaderStyle, marginBottom: 0 }}>{t('details_checkin_info')}</span>
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
                  <dt style={labelStyle}>{t('detail_entry_type')}</dt>
                  <dd style={{ margin: 0, ...valueStyle }}>
                    <PastEntryTypeChip t={t} />
                  </dd>
                  <dt style={labelStyle}>{t('detail_checkin_at_label')}</dt>
                  <dd style={{ margin: 0, ...valueStyle }}>
                    {orDash(checkin.date)} {orDash(checkin.time)}
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
                  <dd style={{ margin: 0, ...valueStyle }}>{orDash(checkin.time)}</dd>
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

  return (
    <div style={{ padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: 8, margin: 4 }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, fontWeight: 600 }}>
        {checkin.checkInType === 'food' ? t('food_beverage_details') : t('beer_details')}
      </div>
      <dl style={{ margin: 0, ...gridStyle } as React.CSSProperties}>
        <dt style={labelStyle}>{t('table_staff')}</dt>
        <dd style={{ margin: 0, ...valueStyle }}>{formatStaffDisplayForCheckinsTable(checkin)}</dd>
        <dt style={labelStyle}>{t('items')}</dt>
        <dd style={{ margin: 0, ...valueStyle }}>{itemsSummary}</dd>
        <dt style={labelStyle}>{t('total')}</dt>
        <dd style={{ margin: 0, ...valueStyle }}>${Number(checkin.cost).toFixed(2)}</dd>
        <dt style={labelStyle}>{t('notes')}</dt>
        <dd style={{ margin: 0, ...valueStyle }}>{orDash(checkin.note)}</dd>
      </dl>
    </div>
  );
}

export default function CheckinsList({
  initialCheckins,
  initialDate,
  role,
}: {
  initialCheckins: CheckIn[];
  initialDate?: string;
  role?: UserRole;
}) {
  const RECORDS_PER_PAGE = 10;
  const router = useRouter();
  const { t } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(initialDate ?? '');
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

  const isAdmin = role === 'admin';
  const colCount = 8;
  const colCountForTotal = colCount - 1;
  const toggleExpanded = (checkin: CheckIn) => {
    const id = stableCheckinRowId(checkin);
    setExpandedId((prev) => (prev === id ? null : id));
  };

  useEffect(() => {
    setSelectedDate(initialDate ?? '');
  }, [initialDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, initialCheckins]);

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

  const handleFilter = () => {
    const params = new URLSearchParams();
    const date = selectedDate.trim();
    if (date) params.set('date', date);
    router.push(`/checkins?${params.toString()}`);
  };

  const handleClearFilters = () => {
    setSelectedDate('');
    router.replace('/checkins');
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    const date = selectedDate.trim();
    if (date) params.set('date', date);
    window.location.href = `/export?${params.toString()}`;
  };

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

  function getFirstItemLabel(c: CheckIn): string {
    const line = c.lineItems?.[0];
    if (line?.itemLabel) return line.itemLabel;
    const sum = c.summarizedItems?.[0];
    if (sum?.itemLabel) return sum.itemLabel;
    return '';
  }
  function getFirstQuantity(c: CheckIn): number {
    const line = c.lineItems?.[0];
    if (line != null && typeof line.quantitySold === 'number') return line.quantitySold;
    const sum = c.summarizedItems?.[0];
    if (sum != null && typeof sum.totalQuantitySold === 'number') return sum.totalQuantitySold;
    return 1;
  }
  function getFirstAmountCollected(c: CheckIn): number {
    const line = c.lineItems?.[0];
    if (line != null && typeof line.amountCollected === 'number') return line.amountCollected;
    const sum = c.summarizedItems?.[0];
    if (sum != null && typeof sum.totalAmountCollected === 'number') return sum.totalAmountCollected;
    return Number(c.cost) || 0;
  }

  function buildDiffLines(checkin: CheckIn, draft: EditCheckinDraft): DiffLine[] {
    const lines: DiffLine[] = [];
    const isRoom = checkin.checkInType !== 'food' && checkin.checkInType !== 'beer';
    const receiptFrom = formatReceiptNumber(checkin.receipt_number ?? '');
    if (isRoom && draft.receipt_number != null && draft.receipt_number !== receiptFrom) {
      lines.push({ label: t('diff_label_receipt'), from: receiptFrom, to: draft.receipt_number });
    }
    if (draft.staff_name !== (checkin.staff_name ?? '')) {
      lines.push({ label: t('diff_label_staff'), from: checkin.staff_name ?? '', to: draft.staff_name });
    }
    if (isRoom) {
      if (checkin.is_past_entry === true) {
        const fromDt = `${checkin.date ?? ''} ${checkin.time ?? ''}`.trim();
        const toDt =
          `${draft.check_in_date ?? checkin.date ?? ''} ${draft.check_in_time ?? checkin.time ?? ''}`.trim();
        if (fromDt !== toDt) {
          lines.push({
            label: t('diff_label_checkin_datetime'),
            from: fromDt || '—',
            to: toDt || '—',
          });
        }
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
    } else {
      const fromLabel = getFirstItemLabel(checkin);
      if (draft.itemLabel != null && draft.itemLabel !== fromLabel) {
        lines.push({
          label: t('diff_label_item'),
          from: fromLabel || t('diff_empty'),
          to: draft.itemLabel,
        });
      }
      if (draft.quantity != null && draft.quantity !== getFirstQuantity(checkin)) {
        lines.push({
          label: t('diff_label_quantity'),
          from: String(getFirstQuantity(checkin)),
          to: String(draft.quantity),
        });
      }
      if (draft.amountCollected != null && Number(draft.amountCollected) !== getFirstAmountCollected(checkin)) {
        lines.push({
          label: t('diff_label_amount_collected'),
          from: `$${getFirstAmountCollected(checkin).toFixed(2)}`,
          to: `$${Number(draft.amountCollected).toFixed(2)}`,
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
        body: JSON.stringify(
          pendingUpdate.checkin.checkInType === 'room'
            ? {
                receipt_number: pendingUpdate.draft.receipt_number,
                staff_name: pendingUpdate.draft.staff_name,
                room_id: pendingUpdate.draft.room_id,
                payment_splits: pendingUpdate.draft.payment_splits,
                ...(pendingUpdate.checkin.is_past_entry === true
                  ? {
                      check_in_date:
                        pendingUpdate.draft.check_in_date ?? pendingUpdate.checkin.date ?? '',
                      check_in_time:
                        pendingUpdate.draft.check_in_time ?? pendingUpdate.checkin.time ?? '',
                    }
                  : {}),
              }
            : {
                staff_name: pendingUpdate.draft.staff_name,
                itemId: pendingUpdate.draft.itemId,
                itemLabel: pendingUpdate.draft.itemLabel,
                quantity: pendingUpdate.draft.quantity,
                amountCollected: pendingUpdate.draft.amountCollected,
              }
        ),
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

  const dateFilterActive = Boolean(initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate));
  const isSpecificDateSelected = dateFilterActive;

  const totalPages = Math.max(1, Math.ceil(initialCheckins.length / RECORDS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * RECORDS_PER_PAGE;
  const visibleCheckins = isSpecificDateSelected
    ? initialCheckins
    : initialCheckins.slice(pageStart, pageStart + RECORDS_PER_PAGE);
  const showPagination = !isSpecificDateSelected && totalPages > 1;

  const sectioned = useMemo(() => {
    if (!dateFilterActive || initialCheckins.length === 0) return null;
    return buildSectionedData(initialCheckins);
  }, [dateFilterActive, initialCheckins]);

  const renderActionsCell = (checkin: CheckIn) => {
    const rowId = stableCheckinRowId(checkin);
    const isExpanded = expandedId === rowId;
    return (
      <td style={{ padding: 8, width: 112, textAlign: 'right', verticalAlign: 'middle' }}>
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

  const tableBody = () => {
    if (sectioned) {
      return (
        <>
          {SECTION_BUCKET_KEYS.map((labelKey, idx) => (
            <Fragment key={idx}>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                <td colSpan={colCount} style={{ padding: 8, fontWeight: 600 }}>
                  {t(labelKey)}
                </td>
              </tr>
              {sectioned.buckets[idx].map((checkin) => (
                <Fragment key={stableCheckinRowId(checkin)}>
                  <tr>
                    <td style={{ padding: 8 }}>{receiptCell(checkin)}</td>
                    <td style={{ padding: 8 }}>{checkin.date}</td>
                    <td style={{ padding: 8 }}>{checkin.time}</td>
                    <td style={{ padding: 8 }}>{typeCell(checkin, t)}</td>
                    <td style={{ padding: 8 }}>{roomCell(checkin, t)}</td>
                    <td style={{ padding: 8 }}>{formatStaffDisplayForCheckinsTable(checkin)}</td>
                    <td style={{ padding: 8 }}>${Number(checkin.cost).toFixed(2)}</td>
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
              ))}
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <td colSpan={colCountForTotal} style={{ padding: 8, textAlign: 'right', fontWeight: 500 }}>
                  {t('list_section_total')}
                </td>
                <td style={{ padding: 8, fontWeight: 500 }}>
                  {renderTotalsBreakdown(sectioned.sectionTotals[idx], t)}
                </td>
              </tr>
            </Fragment>
          ))}
          <tr style={{ backgroundColor: '#e5e7eb', fontWeight: 600 }}>
            <td colSpan={colCountForTotal} style={{ padding: 8, textAlign: 'right' }}>
              {t('list_day_total')}
            </td>
            <td style={{ padding: 8 }}>{renderTotalsBreakdown(sectioned.dayTotals, t)}</td>
          </tr>
        </>
      );
    }
    return visibleCheckins.map((checkin) => (
      <Fragment key={stableCheckinRowId(checkin)}>
        <tr>
          <td style={{ padding: 8 }}>{receiptCell(checkin)}</td>
          <td style={{ padding: 8 }}>{checkin.date}</td>
          <td style={{ padding: 8 }}>{checkin.time}</td>
          <td style={{ padding: 8 }}>{typeCell(checkin, t)}</td>
          <td style={{ padding: 8 }}>{roomCell(checkin, t)}</td>
          <td style={{ padding: 8 }}>{formatStaffDisplayForCheckinsTable(checkin)}</td>
          <td style={{ padding: 8 }}>${Number(checkin.cost).toFixed(2)}</td>
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
    ));
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <strong>{t('list_filter_by_day')}</strong>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <label>
            <div>{t('date')}</div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button variant="primary" onClick={handleFilter}>
              {t('list_filter')}
            </Button>
            <Button variant="ghost" onClick={handleClearFilters} disabled={!dateFilterActive}>
              {t('list_clear_filters')}
            </Button>
            <Button variant="secondary" onClick={handleExport}>
              {t('export_csv')}
            </Button>
          </div>
        </div>
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

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                  'table_total',
                ] as const
              ).map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>
                  {t(h)}
                </th>
              ))}
              <th
                key="actions"
                style={{ width: 112, padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}
              >
                {t('table_actions')}
              </th>
            </tr>
          </thead>
          <tbody>{tableBody()}</tbody>
        </table>
        {initialCheckins.length === 0 && <div style={{ padding: 16 }}>{t('list_no_checkins')}</div>}
      </div>
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
                <dd style={{ margin: 0 }}>{pendingDelete.time}</dd>
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
