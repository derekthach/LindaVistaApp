'use client';

import { Fragment, useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import type { CheckIn } from '@/types';
import { formatReceiptNumber } from '@/lib/checkins/receipt';

export interface CheckinEditRecord {
  id: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  editedAt: string;
  editedBy: string;
  changedFields: string[];
}

const ZONE = 'America/Puerto_Rico';

const FIELD_LABELS: Record<string, string> = {
  receiptNumber: 'Receipt #',
  staffName: 'Staff',
  cost: 'Cost',
  roomId: 'Room',
  paymentBreakdown: 'Payment Breakdown',
  totalCollected: 'Total Collected',
  item: 'Item',
  quantity: 'Quantity',
  amountCollected: 'Amount Collected',
  roomCheckout: 'Room checkout / cleaning',
};

function formatDiffValue(field: string, value: unknown): string {
  if (value === undefined || value === null) return 'Unknown';
  switch (field) {
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
      return String(Number(value));
    case 'roomCheckout':
      return String(value);
    default:
      return String(value);
  }
}

function formatEditedAt(iso: string): string {
  if (!iso) return 'Unknown';
  const dt = DateTime.fromISO(iso, { zone: ZONE });
  return dt.isValid ? dt.toFormat('yyyy-MM-dd HH:mm') : iso;
}

export default function EditHistoryPanel({
  checkinId,
  checkin,
}: {
  checkinId: string;
  checkin: CheckIn;
}) {
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
        if (!res.ok) throw new Error('Failed to load edit history');
        return res.json();
      })
      .then((data: CheckinEditRecord[]) => {
        if (!cancelled) setEdits(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [checkinId]);

  const createdBy = checkin.staff_name?.trim() || 'Unknown';
  const createdAt = checkin.date && checkin.time ? `${checkin.date} ${checkin.time}` : 'Unknown';

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

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>Edit history</div>
      <div style={{ fontSize: 13 }}>
        <div style={{ marginBottom: 8 }}>
          <span style={labelStyle}>Created by: </span>
          <span style={valueStyle}>{createdBy}</span>
        </div>
        <div style={{ marginBottom: 12 }}>
          <span style={labelStyle}>Created at: </span>
          <span style={valueStyle}>{createdAt}</span>
        </div>
        {loading && <div style={{ color: '#6b7280' }}>Loading...</div>}
        {error && <div style={{ color: '#dc2626' }}>{error}</div>}
        {!loading && !error && edits.length === 0 && (
          <div style={{ color: '#6b7280' }}>No edits to this record</div>
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
                  <span style={labelStyle}>Edited at: </span>
                  <span style={valueStyle}>{formatEditedAt(edit.editedAt)}</span>
                </div>
                <div style={{ marginBottom: 6 }}>
                  <span style={labelStyle}>Edited by: </span>
                  <span style={valueStyle}>{edit.editedBy || 'Unknown'}</span>
                </div>
                <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', alignItems: 'baseline', fontSize: 12 }}>
                  {edit.changedFields.map((field) => {
                    const label = FIELD_LABELS[field] ?? field;
                    const oldVal = formatDiffValue(field, edit.before[field]);
                    const newVal = formatDiffValue(field, edit.after[field]);
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
