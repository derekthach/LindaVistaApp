'use client';

import { useEffect, useState } from 'react';
import type { CheckIn } from '@/types';
import Button from '@/components/Button';
import { normalizeReceipt } from '@/lib/checkins/validation/room';
import { ALLOWED_STAFF } from '@/lib/checkins/validation/updateCheckin';

const ROOM_MIN = 1;
const ROOM_MAX = 40;
const COST_MAX = 1000;

export interface EditCheckinDraft {
  receipt_number: string;
  staff_name: string;
  cost: number;
  room_id: number;
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

  const isRoom = checkin?.checkInType !== 'food' && checkin?.checkInType !== 'beer';

  useEffect(() => {
    if (checkin) {
      setReceiptNumber(checkin.receipt_number?.padStart(4, '0') ?? '');
      setStaffName(checkin.staff_name ?? '');
      setCost(String(checkin.cost ?? ''));
      setRoomId(checkin.room_id ?? 1);
    }
  }, [checkin]);

  const receiptNormalized = normalizeReceipt(receipt_number);
  const costNum = cost.trim() === '' ? NaN : Number(cost);
  const costValid = !Number.isNaN(costNum) && costNum >= 0 && costNum <= COST_MAX;
  const staffValid = ALLOWED_STAFF.includes(staff_name as (typeof ALLOWED_STAFF)[number]);
  const hasChanges =
    receiptNormalized !== (checkin?.receipt_number?.padStart(4, '0') ?? '') ||
    staff_name !== (checkin?.staff_name ?? '') ||
    String(costNum) !== String(checkin?.cost ?? '') ||
    (isRoom && room_id !== (checkin?.room_id ?? 1));
  const formValid =
    receiptNormalized !== null &&
    staffValid &&
    costValid &&
    (!isRoom || (room_id >= ROOM_MIN && room_id <= ROOM_MAX));
  const canSave = formValid && hasChanges && !saveDisabled;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !receiptNormalized) return;
    onSave({
      receipt_number: receiptNormalized,
      staff_name,
      cost: costNum,
      room_id: isRoom ? room_id : 0,
    });
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
              maxLength={4}
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
          {isRoom && (
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
