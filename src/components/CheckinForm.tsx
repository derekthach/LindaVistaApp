'use client';

import { useEffect, useState, useCallback } from 'react';
import { DateTime } from 'luxon';
import { useRouter } from 'next/navigation';
import { useLanguage } from './LanguageToggle';
import { CAR_COLORS } from '@/lib/checkins/colors';
import {
  validateRoomCheckin,
  normalizeReceipt,
} from '@/lib/checkins/validation/room';
import { formatReceiptNumber } from '@/lib/checkins/receipt';
import { getStaffOptionsForRole } from '@/lib/checkins/constants';
import { PAYMENT_METHODS } from '@/lib/checkins/paymentMethods';
import { ROOM_OPTIONS, parseRoomOptionValue } from '@/lib/checkins/rooms';
import StaffDropdown from '@/components/checkins/StaffDropdown';

const ZONE = 'America/Puerto_Rico';
const PLATE_MAX = 10;
const LICENSE_PLATE_REGEX = /^[A-Za-z0-9\- ]*$/;
const NOTE_MAX = 500;

type FormState = {
  room_id: number | string;
  receipt_number: string;
  date: string;
  time: string;
  cost: string;
  payment_method: string;
  car_plate: string;
  car_make: string;
  car_color: string;
  staff_name: string;
  note: string;
};

const defaultState: FormState = {
  room_id: 1,
  receipt_number: '',
  date: '',
  time: '',
  cost: '',
  payment_method: 'cash',
  car_plate: '',
  car_make: '',
  car_color: CAR_COLORS[0]?.key ?? 'black',
  staff_name: '',
  note: '',
};

function CheckinFormContent({
  allowAddCarMake = true,
  allowEditDateTime = true,
}: {
  allowAddCarMake?: boolean;
  allowEditDateTime?: boolean;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [form, setForm] = useState<FormState>(defaultState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [carMakes, setCarMakes] = useState<string[]>([]);
  const [addMakeOpen, setAddMakeOpen] = useState(false);
  const [newMakeInput, setNewMakeInput] = useState('');
  const [addMakeError, setAddMakeError] = useState('');

  useEffect(() => {
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

    fetch('/api/car-makes')
      .then((res) => res.json())
      .then((data) => setCarMakes(data.carMakes ?? []));
  }, []);

  const rawForValidation = useCallback((): Record<string, unknown> => {
    const costNum = form.cost.trim() === '' ? undefined : Number(form.cost);
    return {
      room_id: form.room_id,
      receipt_number: form.receipt_number.trim(),
      date: form.date.trim(),
      time: form.time.trim(),
      cost: costNum,
      payment_method: form.payment_method,
      car_plate: form.car_plate.trim(),
      car_make: form.car_make.trim(),
      car_color: form.car_color,
      staff_name: form.staff_name.trim(),
      note: form.note.trim() || undefined,
    };
  }, [form]);

  const validation = validateRoomCheckin(rawForValidation());
  const isValid = validation.valid;

  const showError = useCallback(
    (field: keyof FormState) => (touched[field] || submitAttempted) && validation.errors[field],
    [touched, submitAttempted, validation.errors]
  );

  const update = useCallback((updates: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...updates }));
  }, []);

  const setTouchedField = useCallback((field: keyof FormState) => {
    setTouched((t) => ({ ...t, [field]: true }));
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

  const handleAddCarMake = useCallback(async () => {
    const name = newMakeInput.trim();
    if (!name) {
      setAddMakeError('Enter a make name');
      return;
    }
    setAddMakeError('');
    try {
      const res = await fetch('/api/car-makes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddMakeError(data.error || 'Failed to add');
        return;
      }
      const nameUpper = data.nameUpper as string;
      if (!carMakes.includes(nameUpper)) {
        setCarMakes((prev) => [...prev, nameUpper].sort());
      }
      setForm((f) => ({ ...f, car_make: nameUpper }));
      setNewMakeInput('');
      setAddMakeOpen(false);
    } catch {
      setAddMakeError('Failed to add car make');
    }
  }, [newMakeInput, carMakes]);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSubmitAttempted(true);
      if (!validation.valid) return;

      const data: Record<string, string> = {
        room_id: String(form.room_id),
        receipt_number: normalizeReceipt(form.receipt_number) ?? form.receipt_number,
        date: form.date.trim(),
        time: form.time.trim(),
        cost: form.cost.trim(),
        payment_method: form.payment_method,
        car_plate: form.car_plate.trim().toUpperCase(),
        car_make: form.car_make.trim().toUpperCase(),
        car_color: form.car_color,
        staff_name: form.staff_name.trim(),
        note: form.note.trim().slice(0, NOTE_MAX),
      };
      sessionStorage.setItem('checkinData', JSON.stringify(data));
      router.push('/checkin/verify');
    },
    [form, validation.valid, router]
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
              value={String(form.room_id)}
              onChange={(e) => update({ room_id: parseRoomOptionValue(e.target.value) })}
              onBlur={() => setTouchedField('room_id')}
              style={inputStyle}
            >
              {ROOM_OPTIONS.map((room) => (
                <option key={String(room)} value={String(room)}>
                  Room {room}
                </option>
              ))}
            </select>
            {showError('room_id') && <div style={errorStyle}>{validation.errors.room_id}</div>}
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
            {showError('receipt_number') && <div style={errorStyle}>{validation.errors.receipt_number}</div>}
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
            {showError('date') && <div style={errorStyle}>{validation.errors.date}</div>}
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
            {showError('time') && <div style={errorStyle}>{validation.errors.time}</div>}
          </label>

          <label>
            <div>{t('cost')}</div>
            <input
              name="cost"
              type="number"
              step="0.01"
              min={0}
              max={1000}
              value={form.cost}
              onChange={(e) => update({ cost: e.target.value })}
              onBlur={() => setTouchedField('cost')}
              style={inputStyle}
            />
            {showError('cost') && <div style={errorStyle}>{validation.errors.cost}</div>}
          </label>

          <label>
            <div>{t('payment_method')}</div>
            <select
              name="payment_method"
              value={form.payment_method}
              onChange={(e) => update({ payment_method: e.target.value })}
              onBlur={() => setTouchedField('payment_method')}
              style={inputStyle}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {t(method)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div>{t('car_plate')}</div>
            <input
              name="car_plate"
              value={form.car_plate}
              onChange={handleCarPlateChange}
              onBlur={handleCarPlateBlur}
              style={inputStyle}
              maxLength={PLATE_MAX}
              placeholder="ABC-123"
            />
            {showError('car_plate') && <div style={errorStyle}>{validation.errors.car_plate}</div>}
          </label>

          <label>
            <div>{t('car_make')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <select
                name="car_make"
                value={form.car_make}
                onChange={(e) => update({ car_make: e.target.value })}
                onBlur={() => setTouchedField('car_make')}
                style={inputStyle}
              >
                <option value="">Select make</option>
                {carMakes.map((make) => (
                  <option key={make} value={make}>
                    {make}
                  </option>
                ))}
              </select>
              {allowAddCarMake && (
                addMakeOpen ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={newMakeInput}
                      onChange={(e) => setNewMakeInput(e.target.value.toUpperCase().slice(0, 30))}
                      placeholder="New make"
                      style={{ ...inputStyle, flex: 1, minWidth: 100 }}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCarMake())}
                    />
                    <button type="button" onClick={handleAddCarMake} className="btn btn-primary" style={{ padding: '6px 12px' }}>
                      Add
                    </button>
                    <button type="button" onClick={() => { setAddMakeOpen(false); setNewMakeInput(''); setAddMakeError(''); }} style={{ padding: '6px 12px' }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAddMakeOpen(true)} style={{ fontSize: 13, color: '#166534' }}>
                    + Add new make
                  </button>
                )
              )}
              {addMakeError && <div style={errorStyle}>{addMakeError}</div>}
            </div>
            {showError('car_make') && <div style={errorStyle}>{validation.errors.car_make}</div>}
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
                  {c.label}
                </option>
              ))}
            </select>
            {showError('car_color') && <div style={errorStyle}>{validation.errors.car_color}</div>}
          </label>

          <StaffDropdown
            value={form.staff_name}
            onChange={(v) => update({ staff_name: v })}
            onBlur={() => setTouchedField('staff_name')}
            isAdmin={allowEditDateTime}
          />
          {showError('staff_name') && <div style={errorStyle}>{validation.errors.staff_name}</div>}
        </div>

        <label>
          <div>{t('note')} (Optional)</div>
          <textarea
            name="note"
            rows={3}
            value={form.note}
            onChange={handleNoteChange}
            style={{ ...inputStyle, resize: 'vertical' }}
            maxLength={NOTE_MAX}
          />
          {validation.errors.note && <div style={errorStyle}>{validation.errors.note}</div>}
        </label>

        <button
          type="submit"
          disabled={!isValid}
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            background: isValid ? '#166534' : '#9ca3af',
            color: '#fff',
            fontWeight: 600,
            cursor: isValid ? 'pointer' : 'not-allowed',
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
}: { allowAddCarMake?: boolean; allowEditDateTime?: boolean } = {}) {
  return (
    <CheckinFormContent allowAddCarMake={allowAddCarMake} allowEditDateTime={allowEditDateTime} />
  );
}
