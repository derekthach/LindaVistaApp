'use client';

import { useEffect, useState } from 'react';
import type { CheckIn } from '@/types';
import Button from '@/components/Button';
import { FOOD_ITEMS, BEER_ITEMS } from '@/lib/checkins/items';
import type { ItemOption } from '@/lib/checkins/items';
import { normalizeReceipt } from '@/lib/checkins/validation/room';
import { formatReceiptNumber } from '@/lib/checkins/receipt';
import { ALLOWED_STAFF } from '@/lib/checkins/validation/updateCheckin';

const ROOM_MIN = 1;
const ROOM_MAX = 40;
const COST_MAX = 1000;
const AMOUNT_COLLECTED_MAX = 1000;
const QUANTITY_MIN = 1;
const QUANTITY_MAX = 999;

export interface EditCheckinDraft {
  receipt_number: string;
  staff_name: string;
  cost?: number;
  room_id?: number;
  itemId?: string;
  itemLabel?: string;
  quantity?: number;
  amountCollected?: number;
}

interface EditCheckinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkin: CheckIn | null;
  onSave: (draft: EditCheckinDraft) => void;
  saveDisabled?: boolean;
}

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

export default function EditCheckinModal({
  open,
  onOpenChange,
  checkin,
  onSave,
  saveDisabled = false,
}: EditCheckinModalProps) {
  const [receipt_number, setReceiptNumber] = useState('');
  const [staff_name, setStaffName] = useState('');
  const [cost, setCost] = useState('');
  const [room_id, setRoomId] = useState(1);
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [amountCollected, setAmountCollected] = useState('');

  const isRoom = checkin?.checkInType !== 'food' && checkin?.checkInType !== 'beer';
  const itemOptions: ItemOption[] = checkin?.checkInType === 'beer' ? BEER_ITEMS : FOOD_ITEMS;

  useEffect(() => {
    if (checkin) {
      setReceiptNumber(formatReceiptNumber(checkin.receipt_number ?? ''));
      setStaffName(checkin.staff_name ?? '');
      setCost(String(checkin.cost ?? ''));
      setRoomId(checkin.room_id ?? 1);
      const options = checkin.checkInType === 'beer' ? BEER_ITEMS : FOOD_ITEMS;
      const firstId = getFirstItemId(checkin);
      const firstLabel = getFirstItemLabel(checkin);
      const byId = options.find((o) => o.id === firstId);
      const byLabel = options.find((o) => o.label.en === firstLabel || o.label.es === firstLabel);
      const resolved = byId ?? byLabel ?? options[0];
      setItemId(resolved?.id ?? '');
      setQuantity(String(getFirstQuantity(checkin)));
      setAmountCollected(String(getFirstAmountCollected(checkin)));
    }
  }, [checkin]);

  const receiptNormalized = normalizeReceipt(receipt_number);
  const costNum = cost.trim() === '' ? NaN : Number(cost);
  const costValid = !Number.isNaN(costNum) && costNum >= 0 && costNum <= COST_MAX;
  const staffValid = ALLOWED_STAFF.includes(staff_name as (typeof ALLOWED_STAFF)[number]);
  const qtyNum = quantity.trim() === '' ? NaN : Math.floor(Number(quantity));
  const qtyValid = !Number.isNaN(qtyNum) && Number.isInteger(qtyNum) && qtyNum >= QUANTITY_MIN && qtyNum <= QUANTITY_MAX;
  const amountNum = amountCollected.trim() === '' ? NaN : Number(amountCollected);
  const amountValid = !Number.isNaN(amountNum) && amountNum >= 0 && amountNum <= AMOUNT_COLLECTED_MAX;

  const hasChangesRoom =
    receiptNormalized !== formatReceiptNumber(checkin?.receipt_number ?? '') ||
    staff_name !== (checkin?.staff_name ?? '') ||
    String(costNum) !== String(checkin?.cost ?? '') ||
    room_id !== (checkin?.room_id ?? 1);
  const hasChangesFoodBeer =
    receiptNormalized !== formatReceiptNumber(checkin?.receipt_number ?? '') ||
    staff_name !== (checkin?.staff_name ?? '') ||
    itemId !== getFirstItemId(checkin ?? ({} as CheckIn)) ||
    qtyNum !== getFirstQuantity(checkin ?? ({} as CheckIn)) ||
    String(amountNum) !== String(getFirstAmountCollected(checkin ?? ({} as CheckIn)));
  const hasChanges = isRoom ? hasChangesRoom : hasChangesFoodBeer;

  const formValidRoom =
    receiptNormalized !== null &&
    staffValid &&
    costValid &&
    room_id >= ROOM_MIN &&
    room_id <= ROOM_MAX;
  const formValidFoodBeer =
    receiptNormalized !== null &&
    staffValid &&
    itemId !== '' &&
    qtyValid &&
    amountValid;
  const formValid = isRoom ? formValidRoom : formValidFoodBeer;
  const canSave = formValid && hasChanges && !saveDisabled;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !receiptNormalized) return;
    if (isRoom) {
      onSave({
        receipt_number: receiptNormalized,
        staff_name,
        cost: costNum,
        room_id,
      });
    } else {
      const selected = itemOptions.find((o) => o.id === itemId);
      onSave({
        receipt_number: receiptNormalized,
        staff_name,
        itemId,
        itemLabel: selected ? selected.label.en : itemId,
        quantity: qtyNum,
        amountCollected: amountNum,
      });
    }
  };

  const handleReceiptBlur = () => {
    const padded = normalizeReceipt(receipt_number);
    if (padded !== null) setReceiptNumber(padded);
  };

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
          Edit check-in
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Date (read-only)</div>
            <input type="text" readOnly value={checkin?.date ?? ''} style={inputStyle} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Time (read-only)</div>
            <input type="text" readOnly value={checkin?.time ?? ''} style={inputStyle} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Type (read-only)</div>
            <input type="text" readOnly value={checkin?.checkInType ?? 'room'} style={inputStyle} />
          </label>
          {checkin?.note != null && checkin.note !== '' && (
            <label>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Notes (read-only)</div>
              <textarea readOnly value={checkin.note} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </label>
          )}

          <label>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Receipt #</div>
            <input
              value={receipt_number}
              onChange={(e) => setReceiptNumber(e.target.value)}
              onBlur={handleReceiptBlur}
              style={inputStyle}
              maxLength={5}
              inputMode="numeric"
            />
          </label>
          <label>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Staff</div>
            <select
              value={staff_name}
              onChange={(e) => setStaffName(e.target.value)}
              style={inputStyle}
              required
            >
              <option value="">Select staff</option>
              {ALLOWED_STAFF.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          {isRoom ? (
            <>
              <label>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Cost</div>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={COST_MAX}
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  style={inputStyle}
                />
              </label>
              <label>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Room number</div>
                <select
                  value={room_id}
                  onChange={(e) => setRoomId(parseInt(e.target.value, 10))}
                  style={inputStyle}
                >
                  {Array.from({ length: ROOM_MAX - ROOM_MIN + 1 }, (_, i) => ROOM_MIN + i).map((r) => (
                    <option key={r} value={r}>
                      Room {r}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Item</div>
                <select
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  style={inputStyle}
                >
                  {itemOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label.en}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Quantity</div>
                <input
                  type="number"
                  min={QUANTITY_MIN}
                  max={QUANTITY_MAX}
                  step={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  style={inputStyle}
                />
              </label>
              <label>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Amount Collected</div>
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
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!canSave}>
              {!hasChanges ? 'No changes to save' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
