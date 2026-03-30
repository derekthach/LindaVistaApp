'use client';

import { useState, useCallback } from 'react';
import type { CheckIn } from '@/types';
import { formatReceiptNumber } from '@/lib/checkins/receipt';
import { formatRoomDisplay } from '@/lib/checkins/rooms';
import { getRoomPaymentBreakdownDisplay } from '@/lib/checkins/roomPaymentSplits';
import { getCarColorLabel } from '@/lib/checkins/colors';
import { getStaffOptionsForCheckout } from '@/lib/checkins/constants';
import Button from '@/components/Button';

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 14,
};

export default function RoomCheckoutModal({
  open,
  checkin,
  onClose,
  onSuccess,
}: {
  open: boolean;
  checkin: CheckIn | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [cleanedBy, setCleanedBy] = useState('');
  const [verified, setVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const staffOptions = getStaffOptionsForCheckout();

  const reset = useCallback(() => {
    setCleanedBy('');
    setVerified(false);
    setSubmitting(false);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    reset();
    onClose();
  }, [submitting, reset, onClose]);

  const handleConfirm = useCallback(async () => {
    if (!checkin?.id || !cleanedBy || !verified || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/checkins/${encodeURIComponent(checkin.id)}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cleanedBy }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Checkout failed');
      }
      reset();
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  }, [checkin?.id, cleanedBy, verified, submitting, reset, onSuccess, onClose]);

  if (!open || !checkin) return null;

  const pay = getRoomPaymentBreakdownDisplay(checkin);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="card" style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 id="checkout-modal-title" style={{ margin: '0 0 12px', fontSize: 20 }}>
          Checkout {formatRoomDisplay(checkin.room_id)}
        </h2>
        <p style={{ margin: '0 0 16px', color: '#374151', fontSize: 14, lineHeight: 1.5 }}>
          Confirming checkout means the guest has left, the room has been cleaned, and the room is ready for the
          next guest. Checkout and cleaning are recorded together for now.
        </p>

        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: '#f9fafb',
            borderRadius: 8,
            fontSize: 13,
            display: 'grid',
            gap: 8,
          }}
        >
          <div>
            <strong>Receipt #</strong> {formatReceiptNumber(checkin.receipt_number ?? '')}
          </div>
          <div>
            <strong>Room</strong> {formatRoomDisplay(checkin.room_id)}
          </div>
          <div>
            <strong>Date / Time</strong> {checkin.date} {checkin.time}
          </div>
          <div>
            <strong>Checked in by</strong> {checkin.staff_name || '—'}
          </div>
          <div>
            <strong>License plate</strong> {checkin.car_plate?.trim() || '—'}
          </div>
          <div>
            <strong>Total collected</strong> ${pay.total.toFixed(2)}
          </div>
          <div>
            <strong>Payment</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {pay.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <strong>Car make</strong> {checkin.car_make?.trim() || '—'}
          </div>
          <div>
            <strong>Car color</strong>{' '}
            {checkin.car_color ? getCarColorLabel(checkin.car_color) : '—'}
          </div>
          <div>
            <strong>Notes</strong> {checkin.note?.trim() || '—'}
          </div>
        </div>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Who cleaned this room?</div>
          <select
            value={cleanedBy}
            onChange={(e) => setCleanedBy(e.target.value)}
            style={inputStyle}
            disabled={submitting}
          >
            <option value="">Select staff</option>
            {staffOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 16, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => setVerified(e.target.checked)}
            disabled={submitting}
            style={{ marginTop: 4 }}
          />
          <span style={{ fontSize: 14 }}>
            I verify this room has been cleaned and is ready for use again.
          </span>
        </label>

        {error && (
          <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleConfirm()}
            disabled={!cleanedBy || !verified || submitting}
          >
            {submitting ? 'Saving…' : 'Confirm checkout'}
          </Button>
        </div>
      </div>
    </div>
  );
}
