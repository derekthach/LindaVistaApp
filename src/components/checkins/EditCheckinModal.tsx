'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CheckIn, CheckInType, RoomPaymentSplit } from '@/types';
import Button from '@/components/Button';
import { FOOD_ITEMS, BEER_ITEMS } from '@/lib/checkins/items';
import type { ItemOption } from '@/lib/checkins/items';
import { normalizeReceipt } from '@/lib/checkins/validation/room';
import { formatReceiptNumber } from '@/lib/checkins/receipt';
import { ALLOWED_STAFF } from '@/lib/checkins/validation/updateCheckin';
import { parseRoomOptionValue, isValidRoomId, roomOptionsForEmployeeEdit } from '@/lib/checkins/rooms';
import { PAYMENT_METHODS, getPaymentMethodTranslationKey, hasStoredPaymentMethodSingle } from '@/lib/checkins/paymentMethods';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { TranslationKey } from '@/lib/i18n/translations';
import { formatRoomDisplay } from '@/lib/checkins/rooms';
import { QuantitySoldInput } from '@/components/checkins/QuantitySoldInput';
import {
  calculatePaymentSplitTotal,
  validatePaymentSplits,
} from '@/lib/checkins/roomPaymentSplits';

const COST_MAX = 1000;
const AMOUNT_COLLECTED_MAX = 1000;
const QUANTITY_MIN = 1;
const QUANTITY_MAX = 999;

export interface EditCheckinDraft {
  checkInType: CheckInType;
  check_in_date: string;
  check_in_time: string;
  /** Trimmed payload; persisted as Firestore note (may be ''). */
  note: string;
  receipt_number?: string;
  staff_name: string;
  room_id?: number | string;
  payment_splits?: RoomPaymentSplit[];
  itemId?: string;
  itemLabel?: string;
  quantity?: number;
  amountCollected?: number;
  payment_method?: string;
}

interface EditCheckinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkin: CheckIn | null;
  onSave: (draft: EditCheckinDraft) => void;
  saveDisabled?: boolean;
  /** When set (e.g. admin View Check-Ins), staff dropdown matches server merged list. */
  staffOptions?: string[];
}

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 14,
};

function storedCheckInType(c: CheckIn): CheckInType {
  return c.checkInType === 'food' || c.checkInType === 'beer' ? c.checkInType : 'room';
}

/** HH:mm extracted from modeled check-in row (Firestore normalizes wall time here). */
function timeHmStored(c: CheckIn): string {
  const raw = (c.time ?? '').trim();
  if (/^\d{2}:\d{2}/.test(raw)) return raw.slice(0, 5);
  return '';
}

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

export default function EditCheckinModal({
  open,
  onOpenChange,
  checkin,
  onSave,
  saveDisabled = false,
  staffOptions,
}: EditCheckinModalProps) {
  const { t, language } = useTranslation();
  const recordTypeLabel = (type: CheckInType) => {
    if (type === 'food') return t('table_type_food');
    if (type === 'beer') return t('table_type_beer');
    return t('table_type_room');
  };

  const [editDate, setEditDate] = useState('');
  const [editTimeHm, setEditTimeHm] = useState('');
  const [note, setNote] = useState('');
  const [receipt_number, setReceiptNumber] = useState('');
  const [staff_name, setStaffName] = useState('');
  const [room_id, setRoomId] = useState<number | string>(1);
  type PayRow = { method: string; amount: string };
  const [paymentRows, setPaymentRows] = useState<PayRow[]>([{ method: 'cash', amount: '' }]);
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [amountCollected, setAmountCollected] = useState('');
  const [foodPaymentMethod, setFoodPaymentMethod] = useState('');

  useEffect(() => {
    if (checkin) {
      const origType = storedCheckInType(checkin);

      setEditDate(checkin.date ?? '');
      setEditTimeHm(timeHmStored(checkin));
      setNote(checkin.note ?? '');

      setReceiptNumber(formatReceiptNumber(checkin.receipt_number ?? ''));
      setStaffName(checkin.staff_name ?? '');
      setRoomId(checkin.room_id ?? 1);

      if (origType === 'room') {
        const splits = checkin.payment_splits;
        if (splits && splits.length > 0) {
          setPaymentRows(splits.map((s) => ({ method: s.method, amount: String(s.amount) })));
        } else {
          setPaymentRows([
            { method: checkin.payment_method || 'cash', amount: String(Number(checkin.cost) || 0) },
          ]);
        }
      } else {
        setPaymentRows([{ method: 'cash', amount: String(Number(checkin.cost) || 0) }]);
      }

      const options = origType === 'beer' ? BEER_ITEMS : FOOD_ITEMS;
      const firstId = getFirstItemId(checkin);
      const firstLabel = getFirstItemLabel(checkin);
      const byId = options.find((o) => o.id === firstId);
      const byLabel = options.find((o) => o.label.en === firstLabel || o.label.es === firstLabel);
      const resolved = byId ?? byLabel ?? options[0];
      setItemId(resolved?.id ?? '');
      setQuantity(String(getFirstQuantity(checkin)));
      setAmountCollected(String(getFirstAmountCollected(checkin)));
      setFoodPaymentMethod(
        hasStoredPaymentMethodSingle(checkin.payment_method)
          ? String(checkin.payment_method).trim()
          : ''
      );
    }
  }, [checkin]);

  const storedType = checkin ? storedCheckInType(checkin) : 'room';
  const effectiveIsRoom = storedType === 'room';
  const itemCatalog: ItemOption[] = storedType === 'beer' ? BEER_ITEMS : FOOD_ITEMS;

  const baseStaffList = useMemo(() => {
    if (staffOptions && staffOptions.length > 0) return [...staffOptions];
    return [...ALLOWED_STAFF];
  }, [staffOptions]);

  const effectiveStaffOptions = useMemo(() => {
    const s = (checkin?.staff_name ?? '').trim();
    if (s && !baseStaffList.includes(s)) {
      return [...baseStaffList, s].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
    }
    return baseStaffList;
  }, [baseStaffList, checkin?.staff_name]);

  const receiptNormalized = effectiveIsRoom ? normalizeReceipt(receipt_number) : null;
  const staffValid = Boolean(staff_name.trim()) && effectiveStaffOptions.includes(staff_name);
  const qtyNum = quantity.trim() === '' ? NaN : Math.floor(Number(quantity));
  const qtyValid = !Number.isNaN(qtyNum) && Number.isInteger(qtyNum) && qtyNum >= QUANTITY_MIN && qtyNum <= QUANTITY_MAX;
  const qtyInputNumeric =
    quantity.trim() === '' ? 0 : Number.isFinite(qtyNum) && qtyNum >= 0 ? qtyNum : 0;
  const amountNum = amountCollected.trim() === '' ? NaN : Number(amountCollected);
  const amountValid = !Number.isNaN(amountNum) && amountNum >= 0 && amountNum <= AMOUNT_COLLECTED_MAX;

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
    if (!checkin || storedCheckInType(checkin) !== 'room') return '';
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

  const hasChangesRoomSpecific =
    !!checkin &&
    effectiveIsRoom &&
    ((receiptNormalized ?? '') !== formatReceiptNumber(checkin.receipt_number ?? '') ||
      currentSplitsJson !== initialSplitsJson ||
      String(room_id) !== String(checkin.room_id ?? 1));

  const hasChangesFoodBeerSpecific =
    !!checkin &&
    !effectiveIsRoom &&
    (itemId !== getFirstItemId(checkin) ||
      qtyNum !== getFirstQuantity(checkin) ||
      String(amountNum) !== String(getFirstAmountCollected(checkin)) ||
      foodPaymentMethod !==
        (hasStoredPaymentMethodSingle(checkin.payment_method)
          ? String(checkin.payment_method).trim()
          : ''));

  const derivedHasChanges =
    !!checkin &&
    (editDate !== (checkin.date ?? '') ||
      editTimeHm !== timeHmStored(checkin) ||
      note.trim() !== (checkin.note?.trim() ?? '') ||
      staff_name !== (checkin.staff_name ?? '') ||
      hasChangesRoomSpecific ||
      hasChangesFoodBeerSpecific);

  const dateTimeOk =
    /^\d{4}-\d{2}-\d{2}$/.test(editDate.trim()) &&
    /^\d{2}:\d{2}$/.test(editTimeHm.trim());

  const formValidRoom =
    effectiveIsRoom &&
    receiptNormalized !== null &&
    staffValid &&
    splitsValid &&
    isValidRoomId(room_id) &&
    dateTimeOk;
  const formValidFoodBeer =
    !effectiveIsRoom &&
    staffValid &&
    itemId !== '' &&
    qtyValid &&
    amountValid &&
    hasStoredPaymentMethodSingle(foodPaymentMethod) &&
    dateTimeOk;
  const formValid = effectiveIsRoom ? formValidRoom : formValidFoodBeer;
  const canSave = formValid && derivedHasChanges && !saveDisabled;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !checkin) return;

    const noteTrim = note.trim();

    if (effectiveIsRoom && splitValidation.splits && receiptNormalized) {
      onSave({
        checkInType: 'room',
        check_in_date: editDate.trim(),
        check_in_time: editTimeHm.trim(),
        note: noteTrim,
        receipt_number: receiptNormalized,
        staff_name,
        room_id,
        payment_splits: splitValidation.splits,
      });
    } else if (!effectiveIsRoom) {
      const selected = itemCatalog.find((o) => o.id === itemId);
      const itemLabelSel =
        selected != null ? (language === 'es' ? selected.label.es : selected.label.en) : itemId;
      onSave({
        checkInType: storedType === 'beer' ? 'beer' : 'food',
        check_in_date: editDate.trim(),
        check_in_time: editTimeHm.trim(),
        note: noteTrim,
        staff_name,
        itemId,
        itemLabel: itemLabelSel,
        quantity: qtyNum,
        amountCollected: amountNum,
        payment_method: foodPaymentMethod,
      });
    }
  };

  const handleReceiptBlur = () => {
    const padded = normalizeReceipt(receipt_number);
    if (padded !== null) setReceiptNumber(padded);
  };

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

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-checkin-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
      }}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="card"
        style={{ minWidth: 360, maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="edit-checkin-title" style={{ margin: '0 0 16px', fontSize: 18 }}>
          {t('aria_edit_checkin')}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('date')}</div>
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              style={inputStyle}
              required
            />
          </label>
          <label>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('time')}</div>
            <input
              type="time"
              value={editTimeHm}
              onChange={(e) => setEditTimeHm(e.target.value)}
              style={inputStyle}
              required
            />
          </label>
          <label>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('table_type')}</div>
            <input type="text" readOnly value={recordTypeLabel(storedType)} style={inputStyle} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('notes')}</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
              placeholder=""
            />
          </label>

          {effectiveIsRoom && (
            <label>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('label_receipt')}</div>
              <input
                value={receipt_number}
                onChange={(e) => setReceiptNumber(e.target.value)}
                onBlur={handleReceiptBlur}
                style={inputStyle}
                maxLength={5}
                inputMode="numeric"
              />
            </label>
          )}
          <label>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('table_staff')}</div>
            <select
              value={staff_name}
              onChange={(e) => setStaffName(e.target.value)}
              style={inputStyle}
              required
            >
              <option value="">{t('select_staff')}</option>
              {effectiveStaffOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          {effectiveIsRoom ? (
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
                          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                            {t('payment_method')}
                          </div>
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
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('room_number')}</div>
                <select
                  value={String(room_id)}
                  onChange={(e) => setRoomId(parseRoomOptionValue(e.target.value))}
                  style={inputStyle}
                >
                  {roomOptionsForEmployeeEdit(room_id).map((r) => (
                    <option key={String(r)} value={String(r)}>
                      {formatRoomDisplay(r, t('room'))}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('payment_method')}</div>
                <select
                  value={foodPaymentMethod}
                  onChange={(e) => setFoodPaymentMethod(e.target.value)}
                  style={inputStyle}
                  required
                >
                  <option value="">{t('payment_method_select_placeholder')}</option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {t(getPaymentMethodTranslationKey(method) as TranslationKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('diff_label_item')}</div>
                <select
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  style={inputStyle}
                  required
                >
                  {itemCatalog.map((opt) => (
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
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={AMOUNT_COLLECTED_MAX}
                  value={amountCollected}
                  onChange={(e) => setAmountCollected(e.target.value)}
                  style={inputStyle}
                />
              </label>
            </>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={!canSave}>
              {!derivedHasChanges ? t('no_changes_to_save') : t('save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
