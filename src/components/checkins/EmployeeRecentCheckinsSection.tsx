'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CheckIn, LineItem, SummarizedItem } from '@/types';
import Button from '@/components/Button';
import { formatRoomDisplay } from '@/lib/checkins/rooms';
import { formatReceiptNumber } from '@/lib/checkins/receipt';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { TranslationKey } from '@/lib/i18n/translations';
import {
  calculatePaymentSplitTotal,
  getRoomPaymentBreakdownDisplayLocalized,
} from '@/lib/checkins/roomPaymentSplits';
import { getPaymentMethodTranslationKey, hasStoredPaymentMethodSingle } from '@/lib/checkins/paymentMethods';
import { carColorLabel } from '@/lib/checkins/colors';
import {
  formatGuestAwarePersonDisplay,
  formatStaffDisplayForCheckinsTable,
} from '@/lib/checkins/staffDisplay';
import EmployeeOperationalEditModal from '@/components/checkins/EmployeeOperationalEditModal';
import PaymentMethodTags from '@/components/checkins/PaymentMethodTags';
import { formatTime } from '@/lib/utils/formatTime';
import { paymentMethodTotalsToCents, totalsToCents } from '@/lib/checkins/sectioning';
import { EMPLOYEE_ENTRY_ACCESS_HOURS } from '@/lib/checkins/employeeAccess';

function centsToCurrency(cents: number, language: 'en' | 'es'): string {
  return new Intl.NumberFormat(language === 'es' ? 'es-PR' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function stableCheckinRowId(c: CheckIn): string {
  if (c.id) return c.id;
  return `legacy:${c.receipt_number}:${c.date}:${c.time}:${String(c.room_id)}:${c.cost}`;
}

function orDash(value: string | undefined): string {
  return value?.trim() ? value.trim() : '—';
}

function displayTime(value: string | undefined): string {
  const formatted = formatTime(value);
  return formatted || orDash(value);
}

function typeCell(checkin: CheckIn, t: (key: TranslationKey) => string): string {
  if (checkin.checkInType === 'food') return t('table_type_food');
  if (checkin.checkInType === 'beer') return t('table_type_beer');
  return t('table_type_room');
}

function getFirstItemLabel(checkin: CheckIn): string {
  const line = checkin.lineItems?.[0];
  if (line?.itemLabel) return line.itemLabel;
  const sum = checkin.summarizedItems?.[0];
  if (sum?.itemLabel) return sum.itemLabel;
  return '';
}

function summaryCell(checkin: CheckIn, t: (key: TranslationKey) => string): string {
  if (checkin.checkInType === 'food' || checkin.checkInType === 'beer') {
    const label = getFirstItemLabel(checkin);
    return label || '—';
  }
  return formatRoomDisplay(checkin.room_id, t('room'));
}

/** Inline details — same layout language as the main check-ins list. */
function RecentCheckinDetails({
  checkin,
  t,
}: {
  checkin: CheckIn;
  t: (key: TranslationKey) => string;
}) {
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
    const hasCheckoutData = checkin.is_checked_out === true;
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          <div style={columnStyle}>
            <div style={sectionHeaderStyle}>{t('details_checkin_info')}</div>
            <dl style={{ margin: 0, ...gridStyle } as React.CSSProperties}>
              <dt style={labelStyle}>{t('label_receipt')}</dt>
              <dd style={{ margin: 0, ...valueStyle }}>{formatReceiptNumber(checkin.receipt_number ?? '')}</dd>
              <dt style={labelStyle}>{t('label_room')}</dt>
              <dd style={{ margin: 0, ...valueStyle }}>{formatRoomDisplay(checkin.room_id, t('room'))}</dd>
              <dt style={labelStyle}>{t('date')}</dt>
              <dd style={{ margin: 0, ...valueStyle }}>{orDash(checkin.date)}</dd>
              <dt style={labelStyle}>{t('time')}</dt>
              <dd style={{ margin: 0, ...valueStyle }}>{displayTime(checkin.time)}</dd>
              <dt style={labelStyle}>{t('label_staff_checkin')}</dt>
              <dd style={{ margin: 0, ...valueStyle }}>{formatStaffDisplayForCheckinsTable(checkin)}</dd>
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
            {hasCheckoutData ? (
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
            const a =
              'totalAmountCollected' in item
                ? (item as SummarizedItem).totalAmountCollected
                : (item as LineItem).amountCollected;
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
        <dt style={labelStyle}>{t('label_receipt')}</dt>
        <dd style={{ margin: 0, ...valueStyle }}>{formatReceiptNumber(checkin.receipt_number ?? '')}</dd>
        <dt style={labelStyle}>{t('table_staff')}</dt>
        <dd style={{ margin: 0, ...valueStyle }}>{formatStaffDisplayForCheckinsTable(checkin)}</dd>
        <dt style={labelStyle}>{t('payment_method')}</dt>
        <dd style={{ margin: 0, ...valueStyle }}>
          {hasStoredPaymentMethodSingle(checkin.payment_method)
            ? t(getPaymentMethodTranslationKey(checkin.payment_method) as TranslationKey)
            : t('payment_method_not_recorded')}
        </dd>
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

function roomTotalDisplay(c: CheckIn): string {
  const splits = c.payment_splits;
  if (splits && splits.length > 0) {
    return `$${calculatePaymentSplitTotal(splits).toFixed(2)}`;
  }
  return `$${Number(c.cost).toFixed(2)}`;
}

export default function EmployeeRecentCheckinsSection({
  guestManualStaffEntry = false,
  /** When true (dedicated page), heading comes from `LocalizedPageHeading`; only the table block is rendered here. */
  omitHeading = false,
}: {
  guestManualStaffEntry?: boolean;
  omitHeading?: boolean;
}) {
  const { t, language } = useTranslation();
  const router = useRouter();
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CheckIn | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoadFailed(false);
    try {
      const res = await fetch('/api/checkins/my-recent', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        const msg = typeof data.error === 'string' ? data.error : null;
        if (msg) setError(msg);
        else setLoadFailed(true);
        setCheckins([]);
        return;
      }
      setCheckins(Array.isArray(data.checkins) ? data.checkins : []);
    } catch (e) {
      if (e instanceof Error && e.message) setError(e.message);
      else setLoadFailed(true);
      setCheckins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const displayError = error ?? (loadFailed ? t('error_failed_to_load') : null);

  useEffect(() => {
    if (!successMessage) return;
    const tid = setTimeout(() => setSuccessMessage(null), 3500);
    return () => clearTimeout(tid);
  }, [successMessage]);

  const recentTotals = useMemo(() => totalsToCents(checkins), [checkins]);
  const recentPaymentTotals = useMemo(() => paymentMethodTotalsToCents(checkins), [checkins]);

  if (guestManualStaffEntry) return null;

  const toggleExpanded = (c: CheckIn) => {
    const id = stableCheckinRowId(c);
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const openEdit = (c: CheckIn) => {
    setEditing(c);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setSuccessMessage(t('employee_recent_saved'));
    void load();
    router.refresh();
  };

  const colCount = 6;

  return (
    <>
      <section style={{ marginTop: omitHeading ? 0 : 32 }}>
        {!omitHeading && (
          <>
            <h2 className="page-title" style={{ fontSize: 22, marginBottom: 4 }}>
              {t('employee_recent_checkins_title')}
            </h2>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>
              {t('employee_recent_checkins_subtitle', { hours: EMPLOYEE_ENTRY_ACCESS_HOURS })}
            </p>
          </>
        )}

        {successMessage && (
          <div
            className="card"
            style={{ padding: 12, marginBottom: 12, backgroundColor: '#f0fdf4', color: '#166534', fontSize: 14 }}
          >
            {successMessage}
          </div>
        )}

        {loading && <p style={{ color: '#6b7280' }}>{t('loading')}</p>}
        {displayError && <p style={{ color: '#dc2626' }}>{displayError}</p>}
        {!loading && !displayError && checkins.length === 0 && (
          <p style={{ color: '#6b7280', padding: 16, background: '#f9fafb', borderRadius: 8 }}>
            {t('employee_recent_none', { hours: EMPLOYEE_ENTRY_ACCESS_HOURS })}
          </p>
        )}
        {!loading && checkins.length > 0 && (
          <div className="card">
            <div className="checkins-table-scroll">
            <table className="checkins-table checkins-table--employee">
              <colgroup>
                <col style={{ width: '16%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '28%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '160px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>
                    {t('employee_recent_col_time')}
                  </th>
                  <th style={{ whiteSpace: 'nowrap' }}>
                    {t('employee_recent_col_type')}
                  </th>
                  <th>
                    {t('employee_recent_col_summary')}
                  </th>
                  <th>
                    {t('payment_method')}
                  </th>
                  <th style={{ whiteSpace: 'nowrap' }}>
                    {t('employee_recent_col_total')}
                  </th>
                  <th className="checkins-col-actions" style={{ whiteSpace: 'nowrap' }}>
                    {t('employee_recent_col_actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {checkins.map((c) => {
                  const rowId = stableCheckinRowId(c);
                  const expanded = expandedId === rowId;
                  const timeShown = `${c.date ?? ''} ${displayTime(c.time)}`.trim();
                  return (
                    <Fragment key={rowId}>
                      <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 6px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          {orDash(timeShown)}
                        </td>
                        <td style={{ padding: '8px 6px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          {typeCell(c, t)}
                        </td>
                        <td
                          style={{
                            padding: '8px 6px',
                            verticalAlign: 'middle',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={summaryCell(c, t)}
                        >
                          {summaryCell(c, t)}
                        </td>
                        <td style={{ padding: '8px 6px', verticalAlign: 'middle' }}>
                          <PaymentMethodTags checkin={c} t={t} />
                        </td>
                        <td style={{ padding: '8px 6px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          {roomTotalDisplay(c)}
                        </td>
                        <td className="checkins-col-actions" style={{ padding: '8px 6px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                            <Button type="button" variant="ghost" onClick={() => toggleExpanded(c)}>
                              {expanded ? t('employee_recent_action_hide') : t('employee_recent_action_view')}
                            </Button>
                            <Button type="button" variant="secondary" onClick={() => openEdit(c)}>
                              {t('employee_recent_action_edit')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={colCount} style={{ padding: 0, borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' }}>
                            <RecentCheckinDetails checkin={c} t={t} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
        {!loading && !displayError && (
          <div
            className="card"
            style={{
              marginTop: 16,
              padding: 12,
              backgroundColor: '#f3f4f6',
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#374151' }}>
              {t('employee_recent_totals_heading')}
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px 12px',
                fontSize: 12,
                lineHeight: 1.65,
                color: '#1f2937',
              }}
            >
              <span>
                {t('list_totals_cars')}: {recentTotals.carCount}
              </span>
              <span>
                {t('list_totals_room')}: {centsToCurrency(recentTotals.roomCents, language)}
              </span>
              <span>
                {t('list_totals_food')}: {centsToCurrency(recentTotals.foodCents, language)}
              </span>
              <span>
                {t('list_totals_beer')}: {centsToCurrency(recentTotals.beerCents, language)}
              </span>
              <strong>
                {t('list_totals_label')}: {centsToCurrency(recentTotals.totalCents, language)}
              </strong>
            </div>
            <div style={{ fontWeight: 600, fontSize: 12, marginTop: 10, marginBottom: 6, color: '#4b5563' }}>
              {t('employee_recent_payment_totals_heading')}
            </div>
            {recentPaymentTotals.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px 12px',
                  fontSize: 12,
                  lineHeight: 1.65,
                  color: '#1f2937',
                }}
              >
                {recentPaymentTotals.map(({ method, cents }) => (
                  <span key={method}>
                    {method === 'unspecified'
                      ? t('employee_recent_payment_method_unspecified')
                      : t(getPaymentMethodTranslationKey(method) as TranslationKey)}
                    : {centsToCurrency(cents, language)}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.65, color: '#6b7280' }}>
                {t('employee_recent_payment_totals_empty')}
              </p>
            )}
          </div>
        )}
      </section>

      <EmployeeOperationalEditModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditing(null);
        }}
        checkin={editing}
        onSaved={handleSaved}
      />
    </>
  );
}
