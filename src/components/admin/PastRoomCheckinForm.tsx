'use client';

import { useActionState, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitPastRoomCheckinAction } from '@/app/actions/pastRoomCheckin';
import Button from '@/components/Button';
import {
  ADMIN_LATE_ROOM_OPTIONS,
  parseAdminLateRoomOptionValue,
  formatRoomDisplay,
  isValidAdminLateRoomId,
} from '@/lib/checkins/rooms';
import PaymentSplitsEditor from '@/components/checkins/PaymentSplitsEditor';
import {
  calculatePaymentSplitTotal,
  defaultPaymentSplitFormRow,
  paymentFormRowsToRaw,
  type PaymentSplitFormRow,
  validatePaymentSplits,
  ADMIN_PAST_ENTRY_PAYMENT_SPLIT_OPTIONS,
} from '@/lib/checkins/roomPaymentSplits';
import { useTranslation } from '@/lib/i18n/useTranslation';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 14,
};

export default function PastRoomCheckinForm({ staffNames }: { staffNames: string[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(submitPastRoomCheckinAction, {});

  const [roomId, setRoomId] = useState<number | string>(0);
  const [checkInDate, setCheckInDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [staffName, setStaffName] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [paymentRows, setPaymentRows] = useState<PaymentSplitFormRow[]>([defaultPaymentSplitFormRow()]);
  const [note, setNote] = useState('');

  const splitValidation = useMemo(
    () => validatePaymentSplits(paymentFormRowsToRaw(paymentRows), ADMIN_PAST_ENTRY_PAYMENT_SPLIT_OPTIONS),
    [paymentRows]
  );

  const paymentSplitsJson = useMemo(() => {
    if (!splitValidation.valid || !splitValidation.splits?.length) return '';
    return JSON.stringify(splitValidation.splits);
  }, [splitValidation]);

  const liveTotal = splitValidation.valid && splitValidation.splits
    ? calculatePaymentSplitTotal(splitValidation.splits)
    : null;


  const cardStyle: React.CSSProperties = {
    width: '100%',
    padding: 24,
    display: 'grid',
    gap: 16,
  };

  if (state?.ok) {
    return (
      <div className="card" style={cardStyle}>
        <p style={{ margin: '0 0 12px', color: '#166534', fontWeight: 600 }}>{t('past_room_saved')}</p>
        <Button variant="primary" onClick={() => router.push('/checkins')}>
          {t('past_room_view_checkins')}
        </Button>
        <div style={{ marginTop: 12 }}>
          <Button
            variant="ghost"
            onClick={() => {
              window.location.assign('/admin/add-past-entry?tab=room');
            }}
          >
            {t('past_room_add_another')}
          </Button>
        </div>
      </div>
    );
  }

  const fieldGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 14,
    alignItems: 'start',
  };

  return (
    <div className="card" style={cardStyle}>
      {state?.error && (
        <div style={{ padding: 12, backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 14 }}>
          {state.error}
        </div>
      )}

      <form action={formAction} style={{ display: 'grid', gap: 14 }}>
        <input type="hidden" name="payment_splits" value={paymentSplitsJson} />

        <div style={fieldGridStyle}>
          <label style={{ margin: 0, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('room_number')}</div>
            <select
              name="room_id"
              value={String(roomId)}
              onChange={(e) => setRoomId(parseAdminLateRoomOptionValue(e.target.value))}
              style={inputStyle}
              required
            >
              {ADMIN_LATE_ROOM_OPTIONS.map((r) => (
                <option key={String(r)} value={String(r)}>
                  {formatRoomDisplay(r, t('room'))}
                </option>
              ))}
            </select>
          </label>

          <label style={{ margin: 0, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('past_room_field_checkin_date')}</div>
            <input
              type="date"
              name="check_in_date"
              value={checkInDate}
              onChange={(e) => setCheckInDate(e.target.value)}
              style={inputStyle}
              required
            />
          </label>

          <label style={{ margin: 0, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('past_room_field_checkin_time')}</div>
            <input
              type="time"
              name="check_in_time"
              value={checkInTime}
              onChange={(e) => setCheckInTime(e.target.value)}
              style={inputStyle}
              required
            />
          </label>
        </div>

        <div style={fieldGridStyle}>
          <label style={{ margin: 0, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('past_room_field_staff_attribution')}</div>
            <select
              name="staff_name"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              style={inputStyle}
              required
            >
              <option value="">{t('staff_select_placeholder')}</option>
              {staffNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ margin: 0, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('receipt_number')}</div>
            <input
              name="receipt_number"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              style={inputStyle}
              maxLength={5}
              inputMode="numeric"
              placeholder=""
              required
            />
          </label>
        </div>

        <PaymentSplitsEditor
          value={paymentRows}
          onChange={setPaymentRows}
          validation={splitValidation}
          validateOptions={ADMIN_PAST_ENTRY_PAYMENT_SPLIT_OPTIONS}
          showError={!splitValidation.valid}
          inputStyle={inputStyle}
          totalLabelKey="label_total_collected"
          amountInputMax={ADMIN_PAST_ENTRY_PAYMENT_SPLIT_OPTIONS.maxRowAmount}
        />

        <label style={{ margin: 0 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('notes')}</div>
          <textarea
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }}
            maxLength={500}
          />
        </label>

        <Button
          type="submit"
          variant="primary"
          disabled={
            isPending ||
            !paymentSplitsJson ||
            !checkInDate ||
            !checkInTime ||
            !staffName.trim() ||
            !receiptNumber.trim() ||
            liveTotal == null ||
            liveTotal <= 0 ||
            !isValidAdminLateRoomId(roomId)
          }
        >
          {isPending ? t('saving_confirm') : t('submit')}
        </Button>
      </form>
    </div>
  );
}
