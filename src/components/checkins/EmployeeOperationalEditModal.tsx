'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CheckIn } from '@/types';
import Button from '@/components/Button';
import { FOOD_ITEMS, BEER_ITEMS } from '@/lib/checkins/items';
import type { ItemOption } from '@/lib/checkins/items';
import { PAYMENT_METHODS } from '@/lib/checkins/paymentMethods';
import {
  calculatePaymentSplitTotal,
  validatePaymentSplits,
} from '@/lib/checkins/roomPaymentSplits';
import { getPaymentMethodTranslationKey } from '@/lib/checkins/paymentMethods';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { TranslationKey } from '@/lib/i18n/translations';
import {
  ROOM_OPTIONS,
  formatRoomDisplay,
  isValidEmployeeRoomCorrection,
  roomOptionsForEmployeeEdit,
  parseEmployeeRoomPatchValue,
  type RoomId,
} from '@/lib/checkins/rooms';
import { QuantitySoldInput } from '@/components/checkins/QuantitySoldInput';
import CarMakeCombobox from '@/components/checkins/CarMakeCombobox';
import type { PersistNewCarMakeResult } from '@/components/checkins/CarMakeCombobox';
import { CAR_COLORS, carColorLabel } from '@/lib/checkins/colors';
import { isValidCarColorKey } from '@/lib/checkins/colors';
import {
  isEmployeeRoomNumberLockedForCompletedStay,
  occupiedRoomKeysFromOtherActiveStays,
  roomOptionsForEmployeeRecentEdit,
} from '@/lib/checkins/roomOccupancy';
import { formatTime } from '@/lib/utils/formatTime';

const COST_MAX = 1000;
const AMOUNT_COLLECTED_MAX = 1000;
const QUANTITY_MIN = 1;
const QUANTITY_MAX = 999;
const PLATE_MAX = 10;
const NOTE_MAX_ROOM = 500;
const NOTE_MAX_ITEM = 250;

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 14,
};

function getFirstItemId(checkin: CheckIn): string {
  const line = checkin.lineItems?.[0];
  if (line?.itemId) return line.itemId;
  const sum = checkin.summarizedItems?.[0];
  if (sum?.itemId) return sum.itemId;
  return '';
}

function getFirstItemLabel(checkin: CheckIn): string {
  const line = checkin.lineItems?.[0];
  if (line?.itemLabel) return line.itemLabel;
  const sum = checkin.summarizedItems?.[0];
  if (sum?.itemLabel) return sum.itemLabel;
  return '';
}

function getFirstQuantity(checkin: CheckIn): number {
  const line = checkin.lineItems?.[0];
  if (line != null && typeof line.quantitySold === 'number') return line.quantitySold;
  const sum = checkin.summarizedItems?.[0];
  if (sum != null && typeof sum.totalQuantitySold === 'number') return sum.totalQuantitySold;
  return 1;
}

function getFirstAmountCollected(checkin: CheckIn): number {
  const line = checkin.lineItems?.[0];
  if (line != null && typeof line.amountCollected === 'number') return line.amountCollected;
  const sum = checkin.summarizedItems?.[0];
  if (sum != null && typeof sum.totalAmountCollected === 'number') return sum.totalAmountCollected;
  return Number(checkin.cost) || 0;
}

type PayRow = { method: string; amount: string };

export default function EmployeeOperationalEditModal({
  open,
  onOpenChange,
  checkin,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkin: CheckIn | null;
  onSaved: () => void;
}) {
  const { t, language } = useTranslation();
  const checkInTypeLabel = (type: string | undefined) => {
    if (type === 'food') return t('table_type_food');
    if (type === 'beer') return t('table_type_beer');
    return t('table_type_room');
  };

  const [paymentRows, setPaymentRows] = useState<PayRow[]>([{ method: 'cash', amount: '' }]);
  const [carPlate, setCarPlate] = useState('');
  const [carMake, setCarMake] = useState('');
  const [carColor, setCarColor] = useState(CAR_COLORS[0]?.key ?? 'black');
  const [noteRoom, setNoteRoom] = useState('');
  const [roomIdSelect, setRoomIdSelect] = useState<RoomId>(1);
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [amountCollected, setAmountCollected] = useState('');
  const [notesFood, setNotesFood] = useState('');
  const [carMakes, setCarMakes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** `null` = loading or not applicable; same `/api/checkins/active-occupied` list as Checkout Rooms. */
  const [activeOccupiedStays, setActiveOccupiedStays] = useState<CheckIn[] | null>(null);

  const isRoom = checkin?.checkInType !== 'food' && checkin?.checkInType !== 'beer';
  const roomNumberLifecycleLocked =
    checkin != null && isRoom && isEmployeeRoomNumberLockedForCompletedStay(checkin);
  const itemOptions: ItemOption[] = checkin?.checkInType === 'beer' ? BEER_ITEMS : FOOD_ITEMS;

  useEffect(() => {
    void fetch('/api/car-makes', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setCarMakes(data.carMakes ?? []));
  }, []);

  useEffect(() => {
    if (!open) {
      setActiveOccupiedStays(null);
      return;
    }
    if (!checkin?.id || !isRoom || roomNumberLifecycleLocked) {
      setActiveOccupiedStays(null);
      return;
    }
    let cancelled = false;
    setActiveOccupiedStays(null);
    void fetch('/api/checkins/active-occupied', { credentials: 'include' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(typeof data.error === 'string' ? data.error : 'load_failed');
        return Array.isArray(data.checkins) ? (data.checkins as CheckIn[]) : [];
      })
      .then((list) => {
        if (!cancelled) setActiveOccupiedStays(list);
      })
      .catch(() => {
        if (!cancelled) setActiveOccupiedStays([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, checkin?.id, checkin?.checkInType, roomNumberLifecycleLocked]);

  useEffect(() => {
    if (!checkin) return;
    setError(null);
    const room = checkin.checkInType !== 'food' && checkin.checkInType !== 'beer';
    if (room) {
      const splits = checkin.payment_splits;
      if (splits && splits.length > 0) {
        setPaymentRows(splits.map((s) => ({ method: s.method, amount: String(s.amount) })));
      } else {
        setPaymentRows([
          { method: checkin.payment_method || 'cash', amount: String(Number(checkin.cost) || 0) },
        ]);
      }
      setCarPlate((checkin.car_plate ?? '').slice(0, PLATE_MAX));
      setCarMake((checkin.car_make ?? '').trim());
      const cc = checkin.car_color ?? '';
      setCarColor(isValidCarColorKey(cc) ? cc : 'other');
      setNoteRoom((checkin.note ?? '').slice(0, NOTE_MAX_ROOM));
      const parsedRoom = parseEmployeeRoomPatchValue(checkin.room_id);
      setRoomIdSelect(parsedRoom ?? (ROOM_OPTIONS[0] as RoomId));
    } else {
      const options = checkin.checkInType === 'beer' ? BEER_ITEMS : FOOD_ITEMS;
      const firstId = getFirstItemId(checkin);
      const firstLabel = getFirstItemLabel(checkin);
      const byId = options.find((o) => o.id === firstId);
      const byLabel = options.find((o) => o.label.en === firstLabel || o.label.es === firstLabel);
      const resolved = byId ?? byLabel ?? options[0];
      setItemId(resolved?.id ?? '');
      setQuantity(String(getFirstQuantity(checkin)));
      setAmountCollected(String(getFirstAmountCollected(checkin)));
      setNotesFood((checkin.note ?? '').slice(0, NOTE_MAX_ITEM));
    }
  }, [checkin]);

  const persistNewCarMake = useCallback(async (trimmedName: string): Promise<PersistNewCarMakeResult> => {
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

  const qtyNum = quantity.trim() === '' ? NaN : Math.floor(Number(quantity));
  const qtyInputNumeric =
    quantity.trim() === '' ? 0 : Number.isFinite(qtyNum) && qtyNum >= 0 ? qtyNum : 0;
  const amountNum = amountCollected.trim() === '' ? NaN : Number(amountCollected);

  const splitValidation = useMemo(
    () =>
      validatePaymentSplits(
        JSON.stringify(
          paymentRows.map((r) => ({
            method: r.method,
            amount: r.amount.trim() === '' ? '' : Number(r.amount),
          }))
        )
      ),
    [paymentRows]
  );
  const splitsValid = splitValidation.valid && !!splitValidation.splits?.length;
  const liveRoomTotal = splitsValid ? calculatePaymentSplitTotal(splitValidation.splits!) : null;

  const initialSplitsJson = useMemo(() => {
    if (!checkin || checkin.checkInType === 'food' || checkin.checkInType === 'beer') return '';
    const splits = checkin.payment_splits;
    if (splits && splits.length > 0) return JSON.stringify(splits);
    return JSON.stringify([
      { method: checkin.payment_method || 'cash', amount: Number(checkin.cost) || 0 },
    ]);
  }, [checkin]);

  const currentSplitsJson = useMemo(() => {
    if (!splitValidation.valid || !splitValidation.splits) return '';
    return JSON.stringify(splitValidation.splits);
  }, [splitValidation]);

  const normalizedStoredColor =
    checkin == null
      ? 'other'
      : isValidCarColorKey(checkin.car_color ?? '')
        ? checkin.car_color
        : 'other';

  const initialRoomParsed = useMemo(
    () => parseEmployeeRoomPatchValue(checkin?.room_id) ?? (ROOM_OPTIONS[0] as RoomId),
    [checkin?.room_id]
  );

  const occupiedOtherKeys = useMemo(() => {
    if (activeOccupiedStays === null || !checkin?.id) return null as Set<string> | null;
    return occupiedRoomKeysFromOtherActiveStays(activeOccupiedStays, checkin.id);
  }, [activeOccupiedStays, checkin?.id]);

  const employeeRoomDropdownOptions = useMemo(() => {
    if (!checkin || !isRoom || roomNumberLifecycleLocked) return [] as RoomId[];
    const base = roomOptionsForEmployeeEdit(checkin.room_id);
    if (occupiedOtherKeys === null) return base;
    return roomOptionsForEmployeeRecentEdit(checkin.room_id, occupiedOtherKeys);
  }, [checkin, isRoom, roomNumberLifecycleLocked, occupiedOtherKeys]);

  useEffect(() => {
    if (!checkin?.id || !isRoom || roomNumberLifecycleLocked || occupiedOtherKeys === null) return;
    const opts = roomOptionsForEmployeeRecentEdit(checkin.room_id, occupiedOtherKeys);
    const allowed = new Set(opts.map((o) => String(o)));
    setRoomIdSelect((prev) => (allowed.has(String(prev)) ? prev : initialRoomParsed));
  }, [occupiedOtherKeys, checkin?.id, checkin?.room_id, roomNumberLifecycleLocked, isRoom, initialRoomParsed]);

  const occupancyResolved = !isRoom || roomNumberLifecycleLocked || activeOccupiedStays !== null;

  const hasChangesRoom =
    (!roomNumberLifecycleLocked && String(roomIdSelect) !== String(initialRoomParsed)) ||
    currentSplitsJson !== initialSplitsJson ||
    carPlate.trim().toUpperCase() !== (checkin?.car_plate ?? '').trim().toUpperCase() ||
    carMake.trim().toUpperCase() !== (checkin?.car_make ?? '').trim().toUpperCase() ||
    carColor !== normalizedStoredColor ||
    noteRoom.trim() !== (checkin?.note ?? '').trim();

  const hasChangesFood =
    itemId !== getFirstItemId(checkin ?? ({} as CheckIn)) ||
    qtyNum !== getFirstQuantity(checkin ?? ({} as CheckIn)) ||
    String(amountNum) !== String(getFirstAmountCollected(checkin ?? ({} as CheckIn))) ||
    notesFood.trim() !== (checkin?.note ?? '').trim();

  const hasChanges = isRoom ? hasChangesRoom : hasChangesFood;

  const qtyValid =
    !Number.isNaN(qtyNum) && Number.isInteger(qtyNum) && qtyNum >= QUANTITY_MIN && qtyNum <= QUANTITY_MAX;
  const amountValid =
    !Number.isNaN(amountNum) && amountNum >= 0 && amountNum <= AMOUNT_COLLECTED_MAX;
  const formValidRoom =
    splitsValid &&
    (roomNumberLifecycleLocked || isValidEmployeeRoomCorrection(roomIdSelect));
  const formValidFood = itemId !== '' && qtyValid && amountValid;
  const formValid = isRoom ? formValidRoom : formValidFood;
  const canSave =
    formValid && hasChanges && !saving && !!checkin?.id && occupancyResolved;

  const updatePaymentRow = useCallback((index: number, patch: Partial<PayRow>) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !checkin?.id) return;
    setSaving(true);
    setError(null);
    try {
      const selectedOpt = itemOptions.find((o) => o.id === itemId);
      const resolvedItemLabel =
        selectedOpt != null ? (language === 'es' ? selectedOpt.label.es : selectedOpt.label.en) : itemId;

      const body = isRoom
        ? {
            room_id: roomNumberLifecycleLocked ? initialRoomParsed : roomIdSelect,
            payment_splits: splitValidation.splits,
            car_plate: carPlate.trim().toUpperCase().slice(0, PLATE_MAX),
            car_make: carMake.trim(),
            car_color: carColor,
            note: noteRoom.trim().slice(0, NOTE_MAX_ROOM),
          }
        : {
            itemId,
            itemLabel: resolvedItemLabel,
            quantity: qtyNum,
            amountCollected: amountNum,
            notes: notesFood.trim().slice(0, NOTE_MAX_ITEM),
          };

      const res = await fetch(`/api/checkins/${checkin.id}/employee`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const rawErr = typeof data.error === 'string' ? data.error : '';
        const msg =
          rawErr === 'Edit window expired'
            ? t('employee_recent_error_window')
            : rawErr === 'Forbidden'
              ? t('employee_recent_error_forbidden')
              : rawErr === 'error_room_required'
                ? t('error_room_required')
                : rawErr === 'error_room_invalid'
                  ? t('error_room_invalid')
                  : rawErr === 'error_employee_room_occupied'
                    ? t('error_employee_room_occupied')
                    : rawErr || t('error_failed_to_load');
        setError(msg);
        return;
      }
      onSaved();
      onOpenChange(false);
    } catch {
      setError(t('error_failed_to_load'));
    } finally {
      setSaving(false);
    }
  };

  if (!open || !checkin) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="employee-edit-checkin-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
      }}
      onClick={() => !saving && onOpenChange(false)}
    >
      <div
        className="card"
        style={{
          minWidth: 360,
          maxWidth: 440,
          width: 'min(440px, calc(100vw - 32px))',
          maxHeight: 'min(90vh, calc(100dvh - 32px))',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="employee-edit-checkin-title" style={{ margin: '0 0 16px', fontSize: 18 }}>
          {t('employee_recent_edit_title')}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('edit_field_date_readonly')}</div>
            <input type="text" readOnly value={checkin.date ?? ''} style={{ ...inputStyle, background: '#f9fafb' }} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('edit_field_time_readonly')}</div>
            <input
              type="text"
              readOnly
              value={formatTime(checkin.time) || checkin.time || ''}
              style={{ ...inputStyle, background: '#f9fafb' }}
            />
          </label>
          <label>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('edit_field_type_readonly')}</div>
            <input
              type="text"
              readOnly
              value={checkInTypeLabel(checkin.checkInType)}
              style={{ ...inputStyle, background: '#f9fafb' }}
            />
          </label>
          {isRoom && (
            <label>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('label_room')}</div>
              {roomNumberLifecycleLocked ? (
                <input
                  type="text"
                  readOnly
                  disabled
                  value={formatRoomDisplay(checkin.room_id, t('room'))}
                  style={{ ...inputStyle, background: '#f9fafb' }}
                  aria-describedby="employee-room-locked-help"
                />
              ) : (
                <>
                  <select
                    value={String(roomIdSelect)}
                    disabled={activeOccupiedStays === null}
                    onChange={(e) => {
                      const next = parseEmployeeRoomPatchValue(e.target.value);
                      if (next != null) setRoomIdSelect(next);
                    }}
                    style={inputStyle}
                  >
                    {employeeRoomDropdownOptions.map((r) => (
                      <option key={String(r)} value={String(r)}>
                        {formatRoomDisplay(r, t('room'))}
                      </option>
                    ))}
                  </select>
                  {activeOccupiedStays === null && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{t('loading')}</div>
                  )}
                </>
              )}
              {roomNumberLifecycleLocked && (
                <div
                  id="employee-room-locked-help"
                  style={{ fontSize: 12, color: '#6b7280', marginTop: 6, lineHeight: 1.35 }}
                >
                  {t('employee_recent_room_locked_help')}
                </div>
              )}
            </label>
          )}
          <label>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('label_receipt')}</div>
            <input type="text" readOnly value={checkin.receipt_number ?? ''} style={{ ...inputStyle, background: '#f9fafb' }} />
          </label>

          {isRoom ? (
            <>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, fontWeight: 600 }}>
                  {t('payment_breakdown')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {paymentRows.map((row, idx) => {
                    const usedElsewhere = new Set(paymentRows.filter((_, i) => i !== idx).map((r) => r.method));
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr auto',
                          gap: 8,
                          alignItems: 'end',
                        }}
                      >
                        <label style={{ margin: 0 }}>
                          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('payment_method')}</div>
                          <select
                            value={row.method}
                            onChange={(e) => updatePaymentRow(idx, { method: e.target.value })}
                            style={inputStyle}
                          >
                            {PAYMENT_METHODS.map((method) => (
                              <option key={method} value={method} disabled={usedElsewhere.has(method)}>
                                {t(getPaymentMethodTranslationKey(method) as TranslationKey)}
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
                            max={COST_MAX}
                            value={row.amount}
                            onChange={(e) => updatePaymentRow(idx, { amount: e.target.value })}
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
                            fontSize: 13,
                            background: paymentRows.length <= 1 ? '#f3f4f6' : '#fff',
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
                    fontSize: 13,
                  }}
                >
                  {t('add_payment_method')}
                </button>
                <div style={{ marginTop: 10, fontWeight: 600 }}>
                  {t('label_total_collected')}: {liveRoomTotal != null ? `$${liveRoomTotal.toFixed(2)}` : '—'}
                </div>
                {!splitsValid && splitValidation.error && (
                  <div style={{ color: '#dc2626', fontSize: 12, marginTop: 6 }}>
                    {t(splitValidation.error as TranslationKey)}
                  </div>
                )}
              </div>
              <label>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('car_plate')}</div>
                <input
                  value={carPlate}
                  onChange={(e) => {
                    let v = e.target.value.toUpperCase();
                    if (v.length > PLATE_MAX) v = v.slice(0, PLATE_MAX);
                    setCarPlate(v);
                  }}
                  style={inputStyle}
                  maxLength={PLATE_MAX}
                />
              </label>
              <label>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('car_make')}</div>
                <CarMakeCombobox
                  options={carMakes}
                  value={carMake}
                  onChange={setCarMake}
                  inputStyle={inputStyle}
                  persistNewCarMake={persistNewCarMake}
                />
              </label>
              <label>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('car_color')}</div>
                <select value={carColor} onChange={(e) => setCarColor(e.target.value)} style={inputStyle}>
                  {CAR_COLORS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {carColorLabel(c.key, t)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('label_notes')}</div>
                <textarea
                  value={noteRoom}
                  onChange={(e) => setNoteRoom(e.target.value.slice(0, NOTE_MAX_ROOM))}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </label>
            </>
          ) : (
            <>
              <label>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('diff_label_item')}</div>
                <select value={itemId} onChange={(e) => setItemId(e.target.value)} style={inputStyle}>
                  {itemOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {language === 'es' ? opt.label.es : opt.label.en}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('diff_label_quantity')}</div>
                <QuantitySoldInput
                  value={qtyInputNumeric}
                  onChange={(n) => setQuantity(n <= 0 ? '' : String(n))}
                  min={QUANTITY_MIN}
                  max={QUANTITY_MAX}
                  style={inputStyle}
                />
              </label>
              <label>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('amount_collected')}</div>
                <div style={{ display: 'flex', width: '100%', alignItems: 'stretch' }}>
                  <span
                    aria-hidden
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0,
                      padding: '0 10px',
                      border: '1px solid #e5e7eb',
                      borderRight: 'none',
                      borderRadius: '8px 0 0 8px',
                      background: '#f9fafb',
                      color: '#374151',
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={AMOUNT_COLLECTED_MAX}
                    value={amountCollected}
                    onChange={(e) => setAmountCollected(e.target.value)}
                    style={{
                      ...inputStyle,
                      width: 'auto',
                      flex: 1,
                      minWidth: 0,
                      borderTopLeftRadius: 0,
                      borderBottomLeftRadius: 0,
                    }}
                  />
                </div>
              </label>
              <label>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('notes')}</div>
                <textarea
                  value={notesFood}
                  onChange={(e) => setNotesFood(e.target.value.slice(0, NOTE_MAX_ITEM))}
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </label>
            </>
          )}

          {error && (
            <div style={{ color: '#dc2626', fontSize: 13 }} role="alert">
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
              {t('cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={!canSave}>
              {saving ? t('saving') : !hasChanges ? t('no_changes_to_save') : t('save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
