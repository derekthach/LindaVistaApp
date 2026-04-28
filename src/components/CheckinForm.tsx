'use client';

import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react';
import { DateTime } from 'luxon';
import { useRouter } from 'next/navigation';
import { useLanguage } from './LanguageToggle';
import { CAR_COLORS, carColorLabel } from '@/lib/checkins/colors';
import type { TranslationKey } from '@/lib/i18n/translations';
import {
  validateRoomCheckin,
  normalizeReceipt,
} from '@/lib/checkins/validation/room';
import { formatReceiptNumber } from '@/lib/checkins/receipt';
import { PAYMENT_METHODS } from '@/lib/checkins/paymentMethods';
import {
  calculatePaymentSplitTotal,
  validatePaymentSplits,
} from '@/lib/checkins/roomPaymentSplits';
import type { RoomPaymentSplit } from '@/types';
import { ROOM_OPTIONS, formatRoomDisplay, parseRoomOptionValue } from '@/lib/checkins/rooms';
import { createRoomSubmissionKey } from '@/lib/checkins/roomSubmissionKey';
import {
  readRoomCheckinDraftFromSession,
  ROOM_CHECKIN_SESSION_STORAGE_KEY,
} from '@/lib/checkins/roomDraft';
import { getAvailableRoomOptions } from '@/lib/checkins/roomOccupancy';
import StaffDropdown from '@/components/checkins/StaffDropdown';
import ManualStaffNameField from '@/components/checkins/ManualStaffNameField';
import CarMakeCombobox from '@/components/checkins/CarMakeCombobox';

const ZONE = 'America/Puerto_Rico';
const PLATE_MAX = 10;
const LICENSE_PLATE_REGEX = /^[A-Za-z0-9\- ]*$/;
const NOTE_MAX = 500;

type PaymentRow = { method: string; amount: string };

type FormState = {
  /** Empty string when no room is selectable (all occupied). */
  room_id: number | string | '';
  receipt_number: string;
  date: string;
  time: string;
  car_plate: string;
  car_make: string;
  car_color: string;
  staff_name: string;
  note: string;
};

const defaultState: FormState = {
  room_id: '',
  receipt_number: '',
  date: '',
  time: '',
  car_plate: '',
  car_make: '',
  car_color: CAR_COLORS[0]?.key ?? 'black',
  staff_name: '',
  note: '',
};

const defaultPaymentRow = (): PaymentRow => ({ method: 'cash', amount: '' });

function CheckinFormContent({
  allowAddCarMake = true,
  allowEditDateTime = true,
  occupiedRoomIds = [],
  lockedStaffName,
  guestManualStaffEntry = false,
}: {
  allowAddCarMake?: boolean;
  allowEditDateTime?: boolean;
  /** Room ids (string form) currently occupied — not shown in room dropdown. */
  occupiedRoomIds?: string[];
  /** When set, staff is fixed (employee auto-attribution); no dropdown. */
  lockedStaffName?: string;
  /** Shared Guest login: staff name is typed each time (never locked to session). */
  guestManualStaffEntry?: boolean;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const te = useCallback((key: string | undefined) => (key ? t(key as TranslationKey) : ''), [t]);
  const [form, setForm] = useState<FormState>(defaultState);
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([defaultPaymentRow()]);
  const [touched, setTouched] = useState<Partial<Record<keyof FormState | 'payment_splits', boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [carMakes, setCarMakes] = useState<string[]>([]);
  /** Set in useLayoutEffect when sessionStorage has a pending room verify draft — skip next-receipt + default date/time. */
  const restoredFromVerifyDraftRef = useRef(false);

  useLayoutEffect(() => {
    const draft = readRoomCheckinDraftFromSession();
    if (!draft) return;
    restoredFromVerifyDraftRef.current = true;
    setForm({
      room_id: draft.room_id,
      receipt_number: draft.receipt_number,
      date: draft.date,
      time: draft.time,
      car_plate: draft.car_plate,
      car_make: draft.car_make,
      car_color: draft.car_color,
      staff_name: draft.staff_name,
      note: draft.note,
    });
    setPaymentRows(draft.paymentRows.length ? draft.paymentRows : [defaultPaymentRow()]);
  }, []);

  useEffect(() => {
    void fetch('/api/car-makes', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setCarMakes(data.carMakes ?? []));
  }, []);

  useEffect(() => {
    if (restoredFromVerifyDraftRef.current) return;

    fetch('/api/next-receipt')
      .then((res) => res.json())
      .then((data) => {
        const next = formatReceiptNumber((data.next_receipt_number ?? '00001').toString());
        setForm((f) => ({ ...f, receipt_number: next }));
      });

    const now = DateTime.now().setZone(ZONE);
    setForm((f) => ({
      ...f,
      date: now.toISODate() ?? '',
      time: now.toFormat('HH:mm'),
    }));
  }, []);

  useEffect(() => {
    if (lockedStaffName) {
      setForm((f) => ({ ...f, staff_name: lockedStaffName }));
    }
  }, [lockedStaffName]);

  const rawForValidation = useCallback((): Record<string, unknown> => {
    const splitsPayload: { method: string; amount: number | string }[] = paymentRows.map((r) => ({
      method: r.method,
      amount: r.amount.trim() === '' ? '' : Number(r.amount),
    }));
    return {
      room_id: form.room_id,
      receipt_number: form.receipt_number.trim(),
      date: form.date.trim(),
      time: form.time.trim(),
      payment_splits: JSON.stringify(splitsPayload),
      car_plate: form.car_plate.trim(),
      car_make: form.car_make.trim(),
      car_color: form.car_color,
      staff_name: form.staff_name.trim(),
      note: form.note.trim() || undefined,
    };
  }, [form, paymentRows]);

  const validation = validateRoomCheckin(rawForValidation());
  const isValid = validation.valid;

  const showError = useCallback(
    (field: keyof FormState | 'payment_splits') =>
      (touched[field] || submitAttempted) &&
      Boolean(validation.errors[field as keyof typeof validation.errors]),
    [touched, submitAttempted, validation.errors]
  );

  const update = useCallback((updates: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...updates }));
  }, []);

  const setTouchedField = useCallback((field: keyof FormState | 'payment_splits') => {
    setTouched((t) => ({ ...t, [field]: true }));
  }, []);

  const splitPreview = useMemo((): RoomPaymentSplit[] | null => {
    const v = validatePaymentSplits(
      JSON.stringify(
        paymentRows.map((r) => ({
          method: r.method,
          amount: r.amount.trim() === '' ? '' : Number(r.amount),
        }))
      )
    );
    return v.valid && v.splits ? v.splits : null;
  }, [paymentRows]);

  const liveTotalCollected = splitPreview ? calculatePaymentSplitTotal(splitPreview) : null;

  const occupiedSet = useMemo(() => new Set(occupiedRoomIds.map(String)), [occupiedRoomIds]);
  const availableRooms = useMemo(
    () => getAvailableRoomOptions(ROOM_OPTIONS, occupiedSet),
    [occupiedSet]
  );

  useEffect(() => {
    setForm((f) => {
      if (availableRooms.length === 0) {
        return { ...f, room_id: '' };
      }
      const cur = String(f.room_id);
      if (cur !== '' && availableRooms.some((r) => String(r) === cur)) return f;
      return { ...f, room_id: '' };
    });
  }, [availableRooms]);

  const updatePaymentRow = useCallback((index: number, patch: Partial<PaymentRow>) => {
    setPaymentRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }, []);

  const addPaymentRow = useCallback(() => {
    const used = new Set(paymentRows.map((r) => r.method));
    const next = PAYMENT_METHODS.find((m) => !used.has(m));
    if (!next) return;
    setPaymentRows((rows) => [...rows, { method: next, amount: '' }]);
  }, [paymentRows]);

  const removePaymentRow = useCallback((index: number) => {
    setPaymentRows((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)));
  }, []);

  const handleReceiptBlur = useCallback(() => {
    const padded = normalizeReceipt(form.receipt_number);
    if (padded !== null) {
      setForm((f) => ({ ...f, receipt_number: padded }));
    }
    setTouchedField('receipt_number');
  }, [form.receipt_number, setTouchedField]);

  const handleCarPlateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let v = e.target.value;
      if (!LICENSE_PLATE_REGEX.test(v)) return;
      if (v.length > PLATE_MAX) v = v.slice(0, PLATE_MAX);
      update({ car_plate: v.toUpperCase() });
    },
    [update]
  );

  const handleCarPlateBlur = useCallback(() => {
    update({ car_plate: form.car_plate.trim().toUpperCase() });
    setTouchedField('car_plate');
  }, [form.car_plate, update, setTouchedField]);

  const handleNoteChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      let v = e.target.value;
      if (v.length > NOTE_MAX) v = v.slice(0, NOTE_MAX);
      update({ note: v });
    },
    [update]
  );

  const persistNewCarMake = useCallback(async (trimmedName: string) => {
    try {
      const res = await fetch('/api/car-makes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false as const, error: 'error_car_make_add_failed' };
      }
      const nameUpper = data.nameUpper as string;
      setCarMakes((prev) => (prev.includes(nameUpper) ? prev : [...prev, nameUpper]).sort());
      return { ok: true as const, nameUpper };
    } catch {
      return { ok: false as const, error: 'error_car_make_network' };
    }
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSubmitAttempted(true);
      if (!validation.valid) return;

      const splitsPayload = paymentRows.map((r) => ({
        method: r.method,
        amount: r.amount.trim() === '' ? '' : Number(r.amount),
      }));
      const submissionKey = createRoomSubmissionKey();
      const data: Record<string, string> = {
        room_id: String(form.room_id),
        receipt_number: normalizeReceipt(form.receipt_number) ?? form.receipt_number,
        date: form.date.trim(),
        time: form.time.trim(),
        payment_splits: JSON.stringify(splitsPayload),
        car_plate: form.car_plate.trim().toUpperCase(),
        car_make: form.car_make.trim().toUpperCase(),
        car_color: form.car_color,
        staff_name: form.staff_name.trim(),
        note: form.note.trim().slice(0, NOTE_MAX),
        submission_key: submissionKey,
      };
      sessionStorage.setItem(ROOM_CHECKIN_SESSION_STORAGE_KEY, JSON.stringify(data));
      router.push('/checkin/verify');
    },
    [form, paymentRows, validation.valid, router]
  );

  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    fontSize: 14,
  };
  const errorStyle = { color: '#dc2626', fontSize: 12, marginTop: 4 };

  return (
    <div className="card">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <label>
            <div>{t('room_number')}</div>
            <select
              name="room_id"
              value={availableRooms.length === 0 ? '' : String(form.room_id)}
              onChange={(e) => {
                const v = e.target.value;
                update({ room_id: v === '' ? '' : parseRoomOptionValue(v) });
              }}
              onBlur={() => setTouchedField('room_id')}
              style={inputStyle}
              disabled={availableRooms.length === 0}
            >
              {availableRooms.length === 0 ? (
                <option value="">{t('all_rooms_occupied')}</option>
              ) : (
                <>
                  <option value="" disabled>
                    {t('room_choose_placeholder')}
                  </option>
                  {availableRooms.map((room) => (
                    <option key={String(room)} value={String(room)}>
                      {formatRoomDisplay(room, t('room'))}
                    </option>
                  ))}
                </>
              )}
            </select>
            {showError('room_id') && <div style={errorStyle}>{te(validation.errors.room_id)}</div>}
          </label>

          <label>
            <div>{t('receipt_number')}</div>
            <input
              name="receipt_number"
              value={form.receipt_number}
              onChange={(e) => update({ receipt_number: e.target.value })}
              onBlur={handleReceiptBlur}
              style={inputStyle}
              placeholder="00000"
              maxLength={5}
              inputMode="numeric"
            />
            {showError('receipt_number') && <div style={errorStyle}>{te(validation.errors.receipt_number)}</div>}
          </label>

          <label>
            <div>{t('date')}</div>
            <input
              name="date"
              type="date"
              value={form.date}
              onChange={(e) => update({ date: e.target.value })}
              onBlur={() => setTouchedField('date')}
              readOnly={!allowEditDateTime}
              disabled={!allowEditDateTime}
              style={inputStyle}
              aria-readonly={!allowEditDateTime}
            />
            {showError('date') && <div style={errorStyle}>{te(validation.errors.date)}</div>}
          </label>

          <label>
            <div>{t('time')}</div>
            <input
              name="time"
              type="time"
              value={form.time}
              onChange={(e) => update({ time: e.target.value })}
              onBlur={() => setTouchedField('time')}
              readOnly={!allowEditDateTime}
              disabled={!allowEditDateTime}
              style={inputStyle}
              aria-readonly={!allowEditDateTime}
            />
            {showError('time') && <div style={errorStyle}>{te(validation.errors.time)}</div>}
          </label>

          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('payment_breakdown')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {paymentRows.map((row, idx) => {
                const usedElsewhere = new Set(
                  paymentRows.filter((_, i) => i !== idx).map((r) => r.method)
                );
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(140px, 1fr) minmax(100px, 1fr) auto',
                      gap: 8,
                      alignItems: 'end',
                    }}
                  >
                    <label style={{ margin: 0 }}>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('payment_method')}</div>
                      <select
                        value={row.method}
                        onChange={(e) => updatePaymentRow(idx, { method: e.target.value })}
                        onBlur={() => setTouchedField('payment_splits')}
                        style={inputStyle}
                      >
                        {PAYMENT_METHODS.map((method) => (
                          <option key={method} value={method} disabled={usedElsewhere.has(method)}>
                            {t(method)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ margin: 0 }}>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('amount')}</div>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        max={1000}
                        value={row.amount}
                        onChange={(e) => updatePaymentRow(idx, { amount: e.target.value })}
                        onBlur={() => setTouchedField('payment_splits')}
                        style={inputStyle}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removePaymentRow(idx)}
                      disabled={paymentRows.length <= 1}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #e5e7eb',
                        background: paymentRows.length <= 1 ? '#f3f4f6' : '#fff',
                        cursor: paymentRows.length <= 1 ? 'not-allowed' : 'pointer',
                        fontSize: 13,
                      }}
                    >
                      {t('remove')}
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={addPaymentRow}
              disabled={paymentRows.length >= PAYMENT_METHODS.length}
              style={{
                marginTop: 10,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #166534',
                background: '#fff',
                color: '#166534',
                fontWeight: 600,
                cursor: paymentRows.length >= PAYMENT_METHODS.length ? 'not-allowed' : 'pointer',
                fontSize: 13,
              }}
            >
              {t('add_payment_method')}
            </button>
            <div style={{ marginTop: 12, fontSize: 15, fontWeight: 600 }}>
              {t('total_collected')}:{' '}
              {liveTotalCollected != null
                ? `$${liveTotalCollected.toFixed(2)}`
                : '—'}
            </div>
            {showError('payment_splits') && (
              <div style={errorStyle}>{te(validation.errors.payment_splits)}</div>
            )}
          </div>

          <label>
            <div>{t('car_plate')}</div>
            <input
              name="car_plate"
              value={form.car_plate}
              onChange={handleCarPlateChange}
              onBlur={handleCarPlateBlur}
              style={inputStyle}
              maxLength={PLATE_MAX}
              placeholder={t('license_plate_placeholder')}
            />
            {showError('car_plate') && <div style={errorStyle}>{te(validation.errors.car_plate)}</div>}
          </label>

          <label>
            <div>{t('car_make')}</div>
            <CarMakeCombobox
              name="car_make"
              options={carMakes}
              value={form.car_make}
              onChange={(make) => update({ car_make: make })}
              onBlur={() => setTouchedField('car_make')}
              inputStyle={inputStyle}
              persistNewCarMake={allowAddCarMake ? persistNewCarMake : undefined}
            />
            {showError('car_make') && <div style={errorStyle}>{te(validation.errors.car_make)}</div>}
          </label>

          <label>
            <div>{t('car_color')}</div>
            <select
              name="car_color"
              value={form.car_color}
              onChange={(e) => update({ car_color: e.target.value })}
              onBlur={() => setTouchedField('car_color')}
              style={inputStyle}
            >
              {CAR_COLORS.map((c) => (
                <option key={c.key} value={c.key}>
                  {carColorLabel(c.key, t)}
                </option>
              ))}
            </select>
            {showError('car_color') && <div style={errorStyle}>{te(validation.errors.car_color)}</div>}
          </label>

          {lockedStaffName ? (
            <label>
              <div>{t('staff_name')}</div>
              <input type="hidden" name="staff_name" value={lockedStaffName} />
              <div
                style={{
                  ...inputStyle,
                  backgroundColor: '#f9fafb',
                  padding: '10px 12px',
                }}
              >
                {lockedStaffName}
              </div>
            </label>
          ) : guestManualStaffEntry ? (
            <ManualStaffNameField
              value={form.staff_name}
              onChange={(v) => update({ staff_name: v })}
              onBlur={() => setTouchedField('staff_name')}
              showGuestHint
              errorText={
                showError('staff_name') && validation.errors.staff_name ? validation.errors.staff_name : null
              }
            />
          ) : (
            <StaffDropdown
              value={form.staff_name}
              onChange={(v) => update({ staff_name: v })}
              onBlur={() => setTouchedField('staff_name')}
              isAdmin={allowEditDateTime}
            />
          )}
          {!guestManualStaffEntry && showError('staff_name') && (
            <div style={errorStyle}>{te(validation.errors.staff_name)}</div>
          )}
        </div>

        <label>
          <div>
            {t('note')} ({t('optional')})
          </div>
          <textarea
            name="note"
            rows={3}
            value={form.note}
            onChange={handleNoteChange}
            style={{ ...inputStyle, resize: 'vertical' }}
            maxLength={NOTE_MAX}
          />
          {validation.errors.note && <div style={errorStyle}>{te(validation.errors.note)}</div>}
        </label>

        <button
          type="submit"
          disabled={!isValid || availableRooms.length === 0}
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            background: isValid && availableRooms.length > 0 ? '#166534' : '#9ca3af',
            color: '#fff',
            fontWeight: 600,
            cursor: isValid && availableRooms.length > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          {t('submit')}
        </button>
      </form>
    </div>
  );
}

export default function CheckinForm({
  allowAddCarMake = true,
  allowEditDateTime = true,
  occupiedRoomIds = [],
  lockedStaffName,
  guestManualStaffEntry = false,
}: {
  allowAddCarMake?: boolean;
  allowEditDateTime?: boolean;
  occupiedRoomIds?: string[];
  lockedStaffName?: string;
  guestManualStaffEntry?: boolean;
} = {}) {
  return (
    <CheckinFormContent
      allowAddCarMake={allowAddCarMake}
      allowEditDateTime={allowEditDateTime}
      occupiedRoomIds={occupiedRoomIds}
      lockedStaffName={lockedStaffName}
      guestManualStaffEntry={guestManualStaffEntry}
    />
  );
}
