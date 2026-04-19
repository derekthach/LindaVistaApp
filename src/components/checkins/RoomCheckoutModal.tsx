'use client';

import { useState, useCallback, useEffect } from 'react';
import type { CheckIn } from '@/types';
import { formatReceiptNumber } from '@/lib/checkins/receipt';
import { formatRoomDisplay } from '@/lib/checkins/rooms';
import { getRoomPaymentBreakdownDisplayLocalized } from '@/lib/checkins/roomPaymentSplits';
import { carColorLabel } from '@/lib/checkins/colors';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { TranslationKey } from '@/lib/i18n/translations';
import { getStaffOptionsForCheckout } from '@/lib/checkins/constants';
import Button from '@/components/Button';
import ManualStaffNameField from '@/components/checkins/ManualStaffNameField';

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
  variant = 'admin',
  employeeCleanerName,
  guestManualStaffEntry = false,
}: {
  open: boolean;
  checkin: CheckIn | null;
  onClose: () => void;
  onSuccess: () => void;
  variant?: 'admin' | 'employee';
  /** Logged-in employee display name (must match merged checkout allowlist: legacy STAFF_MEMBERS + Firestore employees). */
  employeeCleanerName?: string;
  /** Shared Guest login: type who cleaned / verified (not session display name). */
  guestManualStaffEntry?: boolean;
}) {
  const { t } = useTranslation();
  const isEmployee = variant === 'employee';
  const [cleanedBy, setCleanedBy] = useState('');
  const [verified, setVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [staffOptions, setStaffOptions] = useState<string[]>(() => [...getStaffOptionsForCheckout()]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetch('/api/checkins/checkout-staff-options', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { names?: string[] } | null) => {
        if (cancelled || !data?.names?.length) return;
        setStaffOptions(data.names);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const reset = useCallback(() => {
    setCleanedBy('');
    setVerified(false);
    setSubmitting(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!open || !isEmployee) return;
    if (guestManualStaffEntry) {
      setCleanedBy('');
      return;
    }
    if (employeeCleanerName) {
      setCleanedBy(employeeCleanerName);
    }
  }, [open, isEmployee, employeeCleanerName, guestManualStaffEntry]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    reset();
    onClose();
  }, [submitting, reset, onClose]);

  const handleConfirm = useCallback(async () => {
    const employeeTypedName = cleanedBy.trim();
    if (
      !checkin?.id ||
      (!isEmployee && !cleanedBy) ||
      (isEmployee && !guestManualStaffEntry && !employeeCleanerName) ||
      (isEmployee && guestManualStaffEntry && !employeeTypedName) ||
      !verified ||
      submitting
    )
      return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/checkins/${encodeURIComponent(checkin.id)}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cleanedBy: isEmployee
            ? guestManualStaffEntry
              ? employeeTypedName
              : employeeCleanerName
            : cleanedBy,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : t('checkout_failed'));
      }
      reset();
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('checkout_failed'));
    } finally {
      setSubmitting(false);
    }
  }, [
    checkin?.id,
    cleanedBy,
    verified,
    submitting,
    reset,
    onSuccess,
    onClose,
    isEmployee,
    employeeCleanerName,
    guestManualStaffEntry,
    t,
  ]);

  if (!open || !checkin) return null;

  const pay = getRoomPaymentBreakdownDisplayLocalized(checkin, (k) => t(k as TranslationKey));

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
          {t(isEmployee ? 'checkout_modal_title_salida' : 'checkout_modal_title_checkout')}{' '}
          {formatRoomDisplay(checkin.room_id, t('room'))}
        </h2>
        <p style={{ margin: '0 0 16px', color: '#374151', fontSize: 14, lineHeight: 1.5 }}>
          {isEmployee ? t('checkout_modal_intro_employee') : t('checkout_modal_intro_admin')}
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
            <strong>{t('label_receipt')}</strong> {formatReceiptNumber(checkin.receipt_number ?? '')}
          </div>
          <div>
            <strong>{t('label_room')}</strong> {formatRoomDisplay(checkin.room_id, t('room'))}
          </div>
          <div>
            <strong>{t('label_date_time')}</strong> {checkin.date} {checkin.time}
          </div>
          <div>
            <strong>{t('label_checked_in_by')}</strong> {checkin.staff_name || '—'}
          </div>
          <div>
            <strong>{t('label_license_plate')}</strong> {checkin.car_plate?.trim() || '—'}
          </div>
          <div>
            <strong>{t('label_total_collected')}</strong> ${pay.total.toFixed(2)}
          </div>
          <div>
            <strong>{t('label_payment')}</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {pay.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <strong>{t('label_car_make')}</strong> {checkin.car_make?.trim() || '—'}
          </div>
          <div>
            <strong>{t('label_car_color')}</strong>{' '}
            {checkin.car_color ? carColorLabel(checkin.car_color, t) : '—'}
          </div>
          <div>
            <strong>{t('label_notes')}</strong> {checkin.note?.trim() || '—'}
          </div>
        </div>

        {isEmployee && guestManualStaffEntry ? (
          <div style={{ marginBottom: 12 }}>
            <ManualStaffNameField
              name="cleanedBy"
              value={cleanedBy}
              onChange={setCleanedBy}
              showGuestHint
            />
          </div>
        ) : isEmployee ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
              {t('employee_responsible')}
            </div>
            <div style={{ ...inputStyle, background: '#f9fafb' }}>{employeeCleanerName ?? '—'}</div>
          </div>
        ) : (
          <label style={{ display: 'block', marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('who_cleaned_room')}</div>
            <select
              value={cleanedBy}
              onChange={(e) => setCleanedBy(e.target.value)}
              style={inputStyle}
              disabled={submitting}
            >
              <option value="">{t('select_staff')}</option>
              {staffOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}

        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 16, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => setVerified(e.target.checked)}
            disabled={submitting}
            style={{ marginTop: 4 }}
          />
          <span style={{ fontSize: 14 }}>
            {isEmployee ? t('verify_room_cleaned_employee') : t('verify_room_cleaned_admin')}
          </span>
        </label>

        {error && (
          <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleConfirm()}
            disabled={
              (!isEmployee && !cleanedBy) ||
              (isEmployee && !guestManualStaffEntry && !employeeCleanerName) ||
              (isEmployee && guestManualStaffEntry && !cleanedBy.trim()) ||
              !verified ||
              submitting
            }
          >
            {submitting ? t('saving') : isEmployee ? t('confirm_cleaning') : t('confirm_checkout')}
          </Button>
        </div>
      </div>
    </div>
  );
}
