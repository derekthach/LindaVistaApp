'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/LanguageToggle';
import StaffDropdown from '@/components/checkins/StaffDropdown';
import ManualStaffNameField from '@/components/checkins/ManualStaffNameField';
import { getDefaultDateAndTime } from '@/lib/checkins/defaults';
import { FOOD_ITEMS, BEER_ITEMS } from '@/lib/checkins/items';
import type { ItemOption } from '@/lib/checkins/items';
import type { LineItem } from '@/types';
import { getDraft, setDraft } from '@/lib/checkins/draft';
import { validateSimpleCheckin } from '@/lib/checkins/validation';
import type { TranslationKey } from '@/components/LanguageToggle';
import { QuantitySoldInput } from '@/components/checkins/QuantitySoldInput';

const SIMPLE_TYPES: ('food' | 'beer')[] = ['food', 'beer'];
const QUANTITY_MAX = 50;

const initialRow = (): LineItem => ({
  itemId: '',
  itemLabel: '',
  quantitySold: 1,
  amountCollected: 0,
});

function SimpleCheckinFormContent({
  type,
  isAdmin = false,
  employeeDisplayName,
  isGuestEmployee = false,
}: {
  type: 'food' | 'beer';
  isAdmin?: boolean;
  employeeDisplayName?: string;
  /** Shared Guest login: manual staff name each time; do not restore from draft for display. */
  isGuestEmployee?: boolean;
}) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const itemOptions: ItemOption[] = type === 'food' ? FOOD_ITEMS : BEER_ITEMS;

  const { date: defaultDate, time: defaultTime } = getDefaultDateAndTime();
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [staffName, setStaffName] = useState('');
  const [notes, setNotes] = useState('');
  const [lineRows, setLineRows] = useState<LineItem[]>([initialRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [hasAttemptedReview, setHasAttemptedReview] = useState(false);

  const lineItemsForValidation: LineItem[] = useMemo(
    () =>
      lineRows.map((r) => ({
        itemId: r.itemId ?? '',
        itemLabel: r.itemLabel ?? '',
        quantitySold: Number(r.quantitySold) || 0,
        amountCollected: Number(r.amountCollected) ?? 0,
      })),
    [lineRows]
  );

  const validation = useMemo(
    () =>
      validateSimpleCheckin({
        date,
        time,
        staff_name: staffName,
        checkInType: type,
        lineItems: lineItemsForValidation,
        notes: notes || undefined,
      }),
    [date, time, staffName, type, lineItemsForValidation, notes]
  );

  const displayErrors = validation.errors;
  const displayLineItemErrors = validation.lineItemErrors ?? {};
  const formValid = validation.valid;

  const totalAmountCollected = useMemo(
    () => lineRows.reduce((sum, r) => sum + (Number(r.amountCollected) || 0), 0),
    [lineRows]
  );

  useEffect(() => {
    const { date: d, time: tm } = getDefaultDateAndTime();
    setDate(d);
    setTime(tm);
  }, []);

  useEffect(() => {
    const draft = getDraft(type);
    if (draft) {
      setDate(draft.date);
      setTime(draft.time);
      setStaffName(
        isGuestEmployee
          ? ''
          : !isAdmin && employeeDisplayName
            ? employeeDisplayName
            : draft.staff_name
      );
      setNotes(draft.notes ?? '');
      setLineRows(
        draft.lineItems.length > 0
          ? draft.lineItems.map((item) => ({
              itemId: item.itemId,
              itemLabel: item.itemLabel,
              quantitySold: item.quantitySold,
              amountCollected: item.amountCollected,
            }))
          : [initialRow()]
      );
    }
  }, [type, isAdmin, employeeDisplayName, isGuestEmployee]);

  useEffect(() => {
    if (!isAdmin && employeeDisplayName && !isGuestEmployee) {
      setStaffName(employeeDisplayName);
    }
  }, [isAdmin, employeeDisplayName, isGuestEmployee]);

  const getItemLabel = useCallback(
    (item: ItemOption) => (language === 'es' ? item.label.es : item.label.en),
    [language]
  );

  const handleItemSelect = useCallback(
    (rowIndex: number, selectedItemId: string) => {
      if (!selectedItemId) {
        setLineRows((prev) => {
          const next = [...prev];
          next[rowIndex] = { ...next[rowIndex], itemId: '', itemLabel: '' };
          return next;
        });
        return;
      }
      const option = itemOptions.find((o) => o.id === selectedItemId);
      if (!option) return;
      const label = getItemLabel(option);
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
    [itemOptions, getItemLabel]
  );

  const addRow = () => {
    setLineRows((prev) => [...prev, initialRow()]);
  };

  const removeRow = (index: number) => {
    setLineRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateRow = (index: number, field: 'quantitySold' | 'amountCollected', value: number) => {
    setLineRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setHasAttemptedReview(true);
    if (!formValid) return;
    const staff_name = staffName?.trim() ?? '';
    const lineItems: LineItem[] = lineRows
      .filter((r) => r.itemId?.trim())
      .map((r) => ({
        itemId: r.itemId,
        itemLabel: r.itemLabel,
        quantitySold: Math.min(QUANTITY_MAX, Math.max(1, Math.floor(Number(r.quantitySold) || 1))),
        amountCollected: Number(r.amountCollected) ?? 0,
      }));

    setDraft({
      checkInType: type,
      date,
      time,
      staff_name,
      lineItems,
      notes: notes?.trim() ? notes.trim().slice(0, 250) : undefined,
    });
    router.push(`/checkins/new/${type}/validate`);
  };

  const msg = (code: string) => t(code as TranslationKey);

  return (
    <div className="card">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }} noValidate>
        <input type="hidden" name="checkInType" value={type} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          <label>
            <div>{t('date')}</div>
            <input
              name="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              readOnly={!isAdmin}
              disabled={!isAdmin}
              required
              aria-readonly={!isAdmin}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                ...(!isAdmin && { backgroundColor: '#f9fafb' }),
              }}
            />
            {hasAttemptedReview && displayErrors.date && (
              <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{msg(displayErrors.date)}</div>
            )}
          </label>

          <label>
            <div>{t('time')}</div>
            <input
              name="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              readOnly={!isAdmin}
              disabled={!isAdmin}
              aria-readonly={!isAdmin}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                ...(!isAdmin && { backgroundColor: '#f9fafb' }),
              }}
            />
            {hasAttemptedReview && displayErrors.time && (
              <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{msg(displayErrors.time)}</div>
            )}
          </label>

          {!isAdmin && employeeDisplayName && !isGuestEmployee ? (
            <label>
              <div>{t('staff_name')}</div>
              <div
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  backgroundColor: '#f9fafb',
                }}
              >
                {employeeDisplayName}
              </div>
            </label>
          ) : isGuestEmployee && !isAdmin ? (
            <ManualStaffNameField
              value={staffName}
              onChange={setStaffName}
              showGuestHint
              errorText={hasAttemptedReview && displayErrors.staff_name ? displayErrors.staff_name : null}
            />
          ) : (
            <StaffDropdown value={staffName} onChange={setStaffName} isAdmin={isAdmin} />
          )}
          {!(isGuestEmployee && !isAdmin) && hasAttemptedReview && displayErrors.staff_name && (
            <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{msg(displayErrors.staff_name)}</div>
          )}
        </div>

        <section style={{ marginTop: 8 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>{t('items')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {lineRows.map((row, index) => (
              <div
                key={index}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px 120px auto',
                  gap: 12,
                  alignItems: 'start',
                }}
              >
                <label style={{ minWidth: 0 }}>
                  <div style={{ marginBottom: 4 }}>{t('item')}</div>
                  <select
                    value={row.itemId}
                    onChange={(e) => handleItemSelect(index, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #d1d5db',
                    }}
                  >
                    <option value="">{t('item_select_placeholder')}</option>
                    {itemOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {getItemLabel(opt)}
                      </option>
                    ))}
                  </select>
                  {hasAttemptedReview && displayLineItemErrors[index]?.itemId && (
                    <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>
                      {msg(displayLineItemErrors[index].itemId!)}
                    </div>
                  )}
                </label>
                <label style={{ minWidth: 0 }}>
                  <div style={{ marginBottom: 4 }}>{t('quantity_sold')}</div>
                  <QuantitySoldInput
                    value={row.quantitySold}
                    onChange={(n) => updateRow(index, 'quantitySold', n)}
                    min={1}
                    max={QUANTITY_MAX}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #d1d5db',
                    }}
                  />
                  {hasAttemptedReview && displayLineItemErrors[index]?.quantitySold && (
                    <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>
                      {msg(displayLineItemErrors[index].quantitySold!)}
                    </div>
                  )}
                </label>
                <label style={{ minWidth: 0 }}>
                  <div style={{ marginBottom: 4 }}>{t('amount_collected')}</div>
                  <input
                    type="number"
                    min={0.01}
                    max={1000}
                    step={0.01}
                    value={row.amountCollected === 0 ? '' : row.amountCollected}
                    onChange={(e) =>
                      updateRow(index, 'amountCollected', parseFloat(e.target.value) || 0)
                    }
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #d1d5db',
                    }}
                  />
                  {hasAttemptedReview && displayLineItemErrors[index]?.amountCollected && (
                    <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>
                      {msg(displayLineItemErrors[index].amountCollected!)}
                    </div>
                  )}
                </label>
                <div style={{ paddingTop: 28 }}>
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    disabled={lineRows.length <= 1}
                    aria-label={t('remove')}
                    title={t('remove')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      background: '#fff',
                      cursor: lineRows.length <= 1 ? 'not-allowed' : 'pointer',
                      opacity: lineRows.length <= 1 ? 0.5 : 1,
                    }}
                  >
                    {t('remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addRow}
            style={{
              marginTop: 8,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px dashed #d1d5db',
              background: '#f9fafb',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {t('add_another_item')}
          </button>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontWeight: 600 }}>{t('total')}</span>
            <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(totalAmountCollected)}</span>
          </div>
          {hasAttemptedReview && displayErrors.lineItems && (
            <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{msg(displayErrors.lineItems)}</div>
          )}
          {hasAttemptedReview && displayErrors.itemsTotal && (
            <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{msg(displayErrors.itemsTotal)}</div>
          )}
        </section>

        <label>
          <div>
            {t('notes')} ({t('optional')})
          </div>
          <textarea
            name="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={250}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
            }}
          />
          {hasAttemptedReview && displayErrors.notes && (
            <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{msg(displayErrors.notes)}</div>
          )}
        </label>

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            background: '#166534',
            color: '#fff',
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? '...' : t('review')}
        </button>
      </form>
    </div>
  );
}

export default function SimpleCheckinForm({
  type,
  isAdmin = false,
  employeeDisplayName,
  isGuestEmployee = false,
}: {
  type: 'food' | 'beer';
  isAdmin?: boolean;
  employeeDisplayName?: string;
  isGuestEmployee?: boolean;
}) {
  if (!SIMPLE_TYPES.includes(type)) {
    return null;
  }
  return (
    <SimpleCheckinFormContent
      type={type}
      isAdmin={isAdmin}
      employeeDisplayName={employeeDisplayName}
      isGuestEmployee={isGuestEmployee}
    />
  );
}
