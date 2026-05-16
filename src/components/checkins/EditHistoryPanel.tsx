'use client';

import { Fragment, useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import type { CheckIn } from '@/types';
import { formatReceiptNumber } from '@/lib/checkins/receipt';
import {
  formatGuestAwarePersonDisplay,
  formatStaffDisplayForCheckinsTable,
} from '@/lib/checkins/staffDisplay';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { TranslationKey } from '@/lib/i18n/translations';
import { formatTime } from '@/lib/utils/formatTime';
import {
  getPaymentMethodTranslationKey,
  hasStoredPaymentMethodSingle,
  type PaymentMethodValue,
} from '@/lib/checkins/paymentMethods';

export interface CheckinEditRecord {
  id: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  editedAt: string;
  editedBy: string;
  changedFields: string[];
}

const ZONE = 'America/Puerto_Rico';

const FIELD_LABEL_KEYS: Record<string, TranslationKey> = {
  checkInType: 'diff_label_checkin_type',
  checkInAt: 'diff_label_checkin_datetime',
  note: 'diff_label_notes',
  paymentMethod: 'diff_label_payment_method',
  receiptNumber: 'label_receipt',
  staffName: 'table_staff',
  cost: 'cost',
  roomId: 'diff_label_room',
  paymentBreakdown: 'diff_label_payment_breakdown',
  totalCollected: 'diff_label_total_collected',
  item: 'diff_label_item',
  quantity: 'diff_label_quantity',
  amountCollected: 'diff_label_amount_collected',
  roomCheckout: 'edit_history_field_room_checkout',
};

function formatDiffValue(
  field: string,
  value: unknown,
  unknownLabel: string,
  t: (k: TranslationKey) => string
): string {
  if (value === undefined || value === null) return unknownLabel;
  switch (field) {
    case 'checkInType': {
      const s = String(value ?? '').trim();
      if (s === 'food') return t('table_type_food');
      if (s === 'beer') return t('table_type_beer');
      if (s === 'room') return t('table_type_room');
      return s || unknownLabel;
    }
    case 'checkInAt': {
      const s = String(value ?? '').trim();
      if (!s) return unknownLabel;
      const dt = DateTime.fromISO(s, { zone: ZONE });
      if (dt.isValid) return `${dt.toFormat('yyyy-MM-dd')} ${dt.toFormat('HH:mm')}`;
      return s;
    }
    case 'note':
      return String(value).trim() || unknownLabel;
    case 'paymentMethod': {
      const s = String(value ?? '').trim();
      if (!s) return t('payment_method_not_recorded');
      if (!hasStoredPaymentMethodSingle(s)) return s;
      return t(getPaymentMethodTranslationKey(s as PaymentMethodValue) as TranslationKey);
    }
    case 'receiptNumber':
      return formatReceiptNumber(value == null ? '' : String(value));
    case 'cost':
    case 'amountCollected':
    case 'totalCollected':
      return `$${Number(value).toFixed(2)}`;
    case 'paymentBreakdown':
      return String(value);
    case 'quantity':
    case 'roomId':
      if (value === undefined || value === null) return unknownLabel;
      return String(value);
    case 'roomCheckout':
      return String(value);
    default:
      return String(value);
  }
}

export default function EditHistoryPanel({
  checkinId,
  checkin,
}: {
  checkinId: string;
  checkin: CheckIn;
}) {
  const { t, language } = useTranslation();
  const [edits, setEdits] = useState<CheckinEditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checkinId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/checkins/${encodeURIComponent(checkinId)}/edits`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('load_failed');
        return res.json();
      })
      .then((data: CheckinEditRecord[]) => {
        if (!cancelled) setEdits(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setError(t('edit_history_load_failed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [checkinId, t]);

  const createdByRaw = formatStaffDisplayForCheckinsTable(checkin);
  const createdBy = createdByRaw.trim() ? createdByRaw : t('unknown');
  const createdAt =
    checkin.date && checkin.time ? `${checkin.date} ${formatTime(checkin.time) || checkin.time}` : t('unknown');

  const formatEditedAt = (iso: string): string => {
    if (!iso) return t('unknown');
    const dt = DateTime.fromISO(iso, { zone: ZONE });
    if (!dt.isValid) return iso;
    const datePart = language === 'es' ? dt.setLocale('es').toFormat('dd/MM/yyyy') : dt.toFormat('yyyy-MM-dd');
    const timePart = formatTime(dt.toJSDate());
    return `${datePart} ${timePart}`.trim();
  };

  const panelStyle: React.CSSProperties = {
    padding: '12px 16px',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    margin: 4,
    border: '1px solid #e5e7eb',
    minHeight: 120,
  };

  const headerStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
    fontWeight: 600,
  };

  const labelStyle: React.CSSProperties = { color: '#6b7280', fontWeight: 500 };
  const valueStyle: React.CSSProperties = { fontWeight: 500 };
  const unknownLabel = t('unknown');

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>{t('edit_history_title')}</div>
      <div style={{ fontSize: 13 }}>
        <div style={{ marginBottom: 8 }}>
          <span style={labelStyle}>{t('edit_history_created_by')} </span>
          <span style={valueStyle}>{createdBy}</span>
        </div>
        <div style={{ marginBottom: 12 }}>
          <span style={labelStyle}>{t('edit_history_created_at')} </span>
          <span style={valueStyle}>{createdAt}</span>
        </div>
        {loading && <div style={{ color: '#6b7280' }}>{t('loading')}</div>}
        {error && <div style={{ color: '#dc2626' }}>{error}</div>}
        {!loading && !error && edits.length === 0 && (
          <div style={{ color: '#6b7280' }}>{t('edit_history_no_edits')}</div>
        )}
        {!loading && !error && edits.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {edits.map((edit) => (
              <div
                key={edit.id}
                style={{
                  padding: 8,
                  backgroundColor: '#fff',
                  borderRadius: 6,
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ marginBottom: 6 }}>
                  <span style={labelStyle}>{t('edit_history_edited_at')} </span>
                  <span style={valueStyle}>{formatEditedAt(edit.editedAt)}</span>
                </div>
                <div style={{ marginBottom: 6 }}>
                  <span style={labelStyle}>{t('edit_history_edited_by')} </span>
                  <span style={valueStyle}>
                    {edit.editedBy
                      ? formatGuestAwarePersonDisplay(edit.editedBy, checkin)
                      : unknownLabel}
                  </span>
                </div>
                <dl
                  style={{
                    margin: 0,
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: '4px 12px',
                    alignItems: 'baseline',
                    fontSize: 12,
                  }}
                >
                  {edit.changedFields.map((field) => {
                    const labelKey = FIELD_LABEL_KEYS[field];
                    const label = labelKey ? t(labelKey) : field;
                    const oldVal = formatDiffValue(field, edit.before[field], unknownLabel, t);
                    const newVal = formatDiffValue(field, edit.after[field], unknownLabel, t);
                    return (
                      <Fragment key={field}>
                        <dt style={labelStyle}>{label}</dt>
                        <dd style={{ margin: 0, ...valueStyle }}>
                          {oldVal} → {newVal}
                        </dd>
                      </Fragment>
                    );
                  })}
                </dl>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
