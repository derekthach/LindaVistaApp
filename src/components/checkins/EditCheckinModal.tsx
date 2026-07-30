'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CheckIn, CheckInType, LineItem, RoomPaymentSplit } from '@/types';
import Button from '@/components/Button';
import {
  ADMIN_LATE_BEER_ITEMS,
  ADMIN_LATE_FOOD_ITEMS,
  BEER_ITEMS,
  FOOD_ITEMS,
  extendCatalogWithStoredItems,
} from '@/lib/checkins/items';
import type { ItemOption } from '@/lib/checkins/items';
import { normalizeReceipt } from '@/lib/checkins/validation/room';
import { formatReceiptNumber } from '@/lib/checkins/receipt';
import { ALLOWED_STAFF } from '@/lib/checkins/validation/updateCheckin';
import {
  isValidAdminLateRoomId,
  isValidRoomId,
  parseAdminLateRoomOptionValue,
  parseRoomOptionValue,
  roomOptionsForEmployeeEdit,
} from '@/lib/checkins/rooms';
import { hasStoredPaymentMethodSingle } from '@/lib/checkins/paymentMethods';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { formatRoomDisplay } from '@/lib/checkins/rooms';
import { QuantitySoldInput } from '@/components/checkins/QuantitySoldInput';
import PaymentSplitsEditor from '@/components/checkins/PaymentSplitsEditor';
import {
  defaultPaymentSplitFormRow,
  FOOD_BEER_PAYMENT_SPLIT_OPTIONS,
  paymentFormRowsToRaw,
  paymentStateToFormRows,
  type PaymentSplitFormRow,
  validatePaymentSplits,
  validatePaymentSplitsForExpectedTotal,
} from '@/lib/checkins/roomPaymentSplits';
import { validateSimpleCheckin } from '@/lib/checkins/validation';
import { lineItemsFromCheckinRecord } from '@/lib/checkins/lineItemsFromCheckin';

const QUANTITY_MIN = 1;
const QUANTITY_MAX = 50;
const AMOUNT_COLLECTED_MAX = 1000;

const initialFoodBeerRow = (): LineItem => ({
  itemId: '',
  itemLabel: '',
  quantitySold: 1,
  amountCollected: 0,
});

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
  /** Food/beer: full line list (same shape as Firestore `lineItems`). */
  lineItems?: LineItem[];
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
  const [paymentRows, setPaymentRows] = useState<PaymentSplitFormRow[]>([defaultPaymentSplitFormRow()]);
  const [lineRows, setLineRows] = useState<LineItem[]>([initialFoodBeerRow()]);

  useEffect(() => {
    if (checkin) {
      const origType = storedCheckInType(checkin);

      setEditDate(checkin.date ?? '');
      setEditTimeHm(timeHmStored(checkin));
      setNote(checkin.note ?? '');

      setReceiptNumber(formatReceiptNumber(checkin.receipt_number ?? ''));
      setStaffName(checkin.staff_name ?? '');
      setRoomId(checkin.room_id ?? 1);

      setPaymentRows(
        paymentStateToFormRows(
          checkin.payment_splits,
          checkin.payment_method,
          Number(checkin.cost) || 0
        )
      );

      if (origType !== 'room') {
        const existing = lineItemsFromCheckinRecord(checkin);
        setLineRows(existing.length > 0 ? existing : [initialFoodBeerRow()]);
      }
    }
  }, [checkin]);

  const storedType = checkin ? storedCheckInType(checkin) : 'room';
  const effectiveIsRoom = storedType === 'room';
  const itemCatalog: ItemOption[] = useMemo(() => {
    const baseCatalog =
      storedType === 'beer'
        ? checkin?.is_past_entry
          ? ADMIN_LATE_BEER_ITEMS
          : BEER_ITEMS
        : checkin?.is_past_entry
          ? ADMIN_LATE_FOOD_ITEMS
          : FOOD_ITEMS;
    const storedItems = checkin ? lineItemsFromCheckinRecord(checkin) : [];
    return extendCatalogWithStoredItems(baseCatalog, storedItems);
  }, [checkin, storedType]);
  const roomOptions = useMemo(() => {
    const base = roomOptionsForEmployeeEdit(room_id).filter((room) => String(room) !== '0');
    if (!checkin?.is_past_entry) return base;
    return [0, ...base];
  }, [checkin?.is_past_entry, room_id]);

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

  const lineItemsForFoodValidation = useMemo(
    () =>
      lineRows.map((r) => ({
        itemId: r.itemId ?? '',
        itemLabel: r.itemLabel ?? '',
        quantitySold: Number(r.quantitySold) || 0,
        amountCollected: Number(r.amountCollected) ?? 0,
      })),
    [lineRows]
  );

  const foodBeerLiveTotal = useMemo(
    () => lineRows.reduce((sum, r) => sum + (Number(r.amountCollected) || 0), 0),
    [lineRows]
  );

  const roomSplitValidation = useMemo(
    () => validatePaymentSplits(paymentFormRowsToRaw(paymentRows)),
    [paymentRows]
  );

  const foodSplitValidation = useMemo(
    () =>
      validatePaymentSplitsForExpectedTotal(
        paymentFormRowsToRaw(paymentRows),
        foodBeerLiveTotal,
        FOOD_BEER_PAYMENT_SPLIT_OPTIONS
      ),
    [paymentRows, foodBeerLiveTotal]
  );

  const splitValidation = effectiveIsRoom ? roomSplitValidation : foodSplitValidation;
  const splitsValid = splitValidation.valid && !!splitValidation.splits?.length;

  const foodBeerValidation = useMemo(() => {
    const base = validateSimpleCheckin({
      date: editDate,
      time: editTimeHm,
      staff_name,
      checkInType: storedType === 'beer' ? 'beer' : 'food',
      lineItems: lineItemsForFoodValidation,
      notes: note || undefined,
      payment_method: foodSplitValidation.splits?.[0]?.method,
    });
    const errors = { ...base.errors };
    delete errors.payment_method;
    if (!foodSplitValidation.valid) {
      errors.payment_splits = foodSplitValidation.error ?? 'err_payment_invalid_data';
    }
    const valid =
      Object.keys(errors).length === 0 &&
      Object.keys(base.lineItemErrors ?? {}).length === 0 &&
      foodSplitValidation.valid;
    return { ...base, errors, valid };
  }, [
    editDate,
    editTimeHm,
    staff_name,
    storedType,
    lineItemsForFoodValidation,
    note,
    foodSplitValidation,
  ]);

  const initialSplitsJson = useMemo(() => {
    if (!checkin) return '';
    const splits = checkin.payment_splits;
    if (splits && splits.length > 0) return JSON.stringify(splits);
    if (storedCheckInType(checkin) === 'room') {
      return JSON.stringify([
        { method: checkin.payment_method || 'cash', amount: Number(checkin.cost) || 0 },
      ]);
    }
    if (hasStoredPaymentMethodSingle(checkin.payment_method)) {
      return JSON.stringify([
        {
          method: String(checkin.payment_method).trim(),
          amount: Number(checkin.cost) || 0,
        },
      ]);
    }
    return '';
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

  const initialFoodLineJson = useMemo(() => {
    if (!checkin || storedCheckInType(checkin) === 'room') return '';
    return JSON.stringify(lineItemsFromCheckinRecord(checkin));
  }, [checkin]);

  const currentFoodLineJson = useMemo(
    () =>
      JSON.stringify(
        lineRows.map((r) => ({
          itemId: r.itemId,
          itemLabel: r.itemLabel,
          quantitySold: Number(r.quantitySold) || 0,
          amountCollected: Number(r.amountCollected) || 0,
        }))
      ),
    [lineRows]
  );

  const hasChangesFoodBeerSpecific =
    !!checkin &&
    !effectiveIsRoom &&
    (currentFoodLineJson !== initialFoodLineJson || currentSplitsJson !== initialSplitsJson);

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
    (checkin?.is_past_entry ? isValidAdminLateRoomId(room_id) : isValidRoomId(room_id)) &&
    dateTimeOk;
  const formValidFoodBeer =
    !effectiveIsRoom && foodBeerValidation.valid && staffValid && dateTimeOk && splitsValid;
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
    } else if (!effectiveIsRoom && splitValidation.splits) {
      const linePayload: LineItem[] = lineRows
        .filter((r) => r.itemId?.trim())
        .map((r) => ({
          itemId: r.itemId,
          itemLabel: r.itemLabel,
          quantitySold: Math.min(QUANTITY_MAX, Math.max(1, Math.floor(Number(r.quantitySold) || 1))),
          amountCollected: Number(r.amountCollected) ?? 0,
        }));
      onSave({
        checkInType: storedType === 'beer' ? 'beer' : 'food',
        check_in_date: editDate.trim(),
        check_in_time: editTimeHm.trim(),
        note: noteTrim,
        staff_name,
        lineItems: linePayload,
        payment_method: splitValidation.splits[0].method,
        payment_splits: splitValidation.splits,
      });
    }
  };

  const handleReceiptBlur = () => {
    const padded = normalizeReceipt(receipt_number);
    if (padded !== null) setReceiptNumber(padded);
  };

  const getCatalogItemLabel = useCallback(
    (item: ItemOption) => (language === 'es' ? item.label.es : item.label.en),
    [language]
  );

  const handleFoodItemSelect = useCallback(
    (rowIndex: number, selectedItemId: string) => {
      if (!selectedItemId) {
        setLineRows((prev) => {
          const next = [...prev];
          next[rowIndex] = { ...next[rowIndex], itemId: '', itemLabel: '' };
          return next;
        });
        return;
      }
      const option = itemCatalog.find((o) => o.id === selectedItemId);
      if (!option) return;
      const label = getCatalogItemLabel(option);
      setLineRows((prev) => {
        const next = [...prev];
        next[rowIndex] = {
          itemId: selectedItemId,
          itemLabel: label,
          quantitySold: next[rowIndex].quantitySold || 1,
          amountCollected: next[rowIndex].amountCollected ?? 0,
        };
        return next;
      });
    },
    [itemCatalog, getCatalogItemLabel]
  );

  const addFoodBeerRow = useCallback(() => {
    setLineRows((prev) => [...prev, initialFoodBeerRow()]);
  }, []);

  const removeFoodBeerRow = useCallback((index: number) => {
    setLineRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const updateFoodBeerRow = useCallback(
    (index: number, field: 'quantitySold' | 'amountCollected', value: number) => {
      setLineRows((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

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
        style={{ minWidth: 360, maxWidth: 520 }}
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
              <PaymentSplitsEditor
                value={paymentRows}
                onChange={setPaymentRows}
                validation={roomSplitValidation}
                showError={!splitsValid && !!roomSplitValidation.error}
                inputStyle={inputStyle}
                totalLabelKey="label_total_collected"
              />
              <label>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('room_number')}</div>
                <select
                  value={String(room_id)}
                  onChange={(e) =>
                    setRoomId(
                      checkin?.is_past_entry
                        ? parseAdminLateRoomOptionValue(e.target.value)
                        : parseRoomOptionValue(e.target.value)
                    )
                  }
                  style={inputStyle}
                >
                  {roomOptions.map((r) => (
                    <option key={String(r)} value={String(r)}>
                      {formatRoomDisplay(r, t('room'))}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, fontWeight: 600 }}>{t('items')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {lineRows.map((row, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr auto',
                        gap: 8,
                        alignItems: 'end',
                      }}
                    >
                      <label style={{ margin: 0, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('item')}</div>
                        <select
                          value={row.itemId}
                          onChange={(e) => handleFoodItemSelect(idx, e.target.value)}
                          style={inputStyle}
                        >
                          <option value="">{t('item_select_placeholder')}</option>
                          {itemCatalog.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {getCatalogItemLabel(opt)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={{ margin: 0, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                          {t('quantity_sold')}
                        </div>
                        <QuantitySoldInput
                          value={row.quantitySold}
                          onChange={(n) => updateFoodBeerRow(idx, 'quantitySold', n)}
                          min={QUANTITY_MIN}
                          max={QUANTITY_MAX}
                          style={inputStyle}
                        />
                      </label>
                      <label style={{ margin: 0, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                          {t('amount_collected')}
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min={0.01}
                          max={AMOUNT_COLLECTED_MAX}
                          value={row.amountCollected === 0 ? '' : row.amountCollected}
                          onChange={(e) =>
                            updateFoodBeerRow(idx, 'amountCollected', parseFloat(e.target.value) || 0)
                          }
                          style={inputStyle}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeFoodBeerRow(idx)}
                        disabled={lineRows.length <= 1}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid #e5e7eb',
                          fontSize: 13,
                          background: lineRows.length <= 1 ? '#f3f4f6' : '#fff',
                        }}
                      >
                        {t('remove')}
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addFoodBeerRow}
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
                  {t('add_another_item')}
                </button>
                <div style={{ marginTop: 10, fontWeight: 600 }}>
                  {t('total')}:{' '}
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 2,
                  }).format(foodBeerLiveTotal)}
                </div>
              </div>
              <PaymentSplitsEditor
                value={paymentRows}
                onChange={setPaymentRows}
                validation={foodSplitValidation}
                validateOptions={FOOD_BEER_PAYMENT_SPLIT_OPTIONS}
                showError={!foodSplitValidation.valid}
                inputStyle={inputStyle}
                totalLabelKey="label_total_collected"
                amountInputMax={FOOD_BEER_PAYMENT_SPLIT_OPTIONS.maxRowAmount}
              />
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
