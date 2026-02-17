'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LanguageProvider, LanguageToggle, useLanguage } from '@/components/LanguageToggle';
import StaffDropdown from '@/components/checkins/StaffDropdown';
import { getDefaultDateAndTime } from '@/lib/checkins/defaults';
import { FOOD_ITEMS, BEER_ITEMS } from '@/lib/checkins/items';
import type { ItemOption } from '@/lib/checkins/items';
import type { LineItem } from '@/types';
import { getDraft, setDraft } from '@/lib/checkins/draft';
import { validateSimpleCheckin } from '@/lib/checkins/validation';

const SIMPLE_TYPES: ('food' | 'beer')[] = ['food', 'beer'];

const initialRow = (): LineItem => ({
  itemId: '',
  itemLabel: '',
  quantitySold: 1,
  amountCollected: 0,
});

function SimpleCheckinFormContent({ type }: { type: 'food' | 'beer' }) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const itemOptions: ItemOption[] = type === 'food' ? FOOD_ITEMS : BEER_ITEMS;

  const { date: defaultDate, time: defaultTime } = getDefaultDateAndTime();
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [staffName, setStaffName] = useState('');
  const [notes, setNotes] = useState('');
  const [lineRows, setLineRows] = useState<LineItem[]>([initialRow()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lineItemErrors, setLineItemErrors] = useState<
    Record<number, { quantitySold?: string; amountCollected?: string; itemId?: string }>
  >({});
  const [submitting, setSubmitting] = useState(false);

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
      setStaffName(draft.staff_name);
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
  }, [type]);

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
    setErrors({});
    setLineItemErrors({});
    const staff_name = staffName?.trim() ?? '';
    const lineItems: LineItem[] = lineRows
      .filter((r) => r.itemId?.trim())
      .map((r) => ({
        itemId: r.itemId,
        itemLabel: r.itemLabel,
        quantitySold: Number(r.quantitySold) || 1,
        amountCollected: Number(r.amountCollected) ?? 0,
      }));

    const validation = validateSimpleCheckin({
      date,
      time,
      staff_name,
      checkInType: type,
      lineItems,
      notes: notes || undefined,
    });
    if (!validation.valid) {
      setErrors(validation.errors as Record<string, string>);
      if (validation.lineItemErrors) {
        const filledIndices = lineRows
          .map((r, i) => (r.itemId?.trim() ? i : -1))
          .filter((i) => i >= 0);
        const mapped: typeof lineItemErrors = {};
        for (const [key, val] of Object.entries(validation.lineItemErrors)) {
          const submittedIdx = Number(key);
          const clientIdx = filledIndices[submittedIdx];
          if (clientIdx !== undefined) mapped[clientIdx] = val;
        }
        setLineItemErrors(mapped);
      }
      return;
    }

    setDraft({
      checkInType: type,
      date,
      time,
      staff_name,
      lineItems,
      notes: notes || undefined,
    });
    router.push(`/checkins/new/${type}/validate`);
  };

  return (
    <div className="card">
      <LanguageToggle />
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
              type="text"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
              }}
            />
            {errors.date && (
              <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{errors.date}</div>
            )}
          </label>

          <label>
            <div>{t('time')}</div>
            <input
              name="time"
              type="text"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
              }}
            />
            {errors.time && (
              <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{errors.time}</div>
            )}
          </label>

          <StaffDropdown value={staffName} onChange={setStaffName} />
          {errors.staff_name && (
            <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{errors.staff_name}</div>
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
                  {lineItemErrors[index]?.itemId && (
                    <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>
                      {lineItemErrors[index].itemId}
                    </div>
                  )}
                </label>
                <label style={{ minWidth: 0 }}>
                  <div style={{ marginBottom: 4 }}>{t('quantity_sold')}</div>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={row.quantitySold || ''}
                    onChange={(e) =>
                      updateRow(index, 'quantitySold', parseInt(e.target.value, 10) || 1)
                    }
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #d1d5db',
                    }}
                  />
                  {lineItemErrors[index]?.quantitySold && (
                    <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>
                      {lineItemErrors[index].quantitySold}
                    </div>
                  )}
                </label>
                <label style={{ minWidth: 0 }}>
                  <div style={{ marginBottom: 4 }}>{t('amount_collected')}</div>
                  <input
                    type="number"
                    min={0}
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
                  {lineItemErrors[index]?.amountCollected && (
                    <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>
                      {lineItemErrors[index].amountCollected}
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
          {errors.lineItems && (
            <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 8 }}>{errors.lineItems}</div>
          )}
        </section>

        <label>
          <div>{t('notes')} (Optional)</div>
          <textarea
            name="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
            }}
          />
        </label>

        {errors.form && (
          <div style={{ fontSize: 14, color: '#b91c1c' }}>{errors.form}</div>
        )}

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

export default function SimpleCheckinForm({ type }: { type: 'food' | 'beer' }) {
  if (!SIMPLE_TYPES.includes(type)) {
    return null;
  }
  return (
    <LanguageProvider>
      <SimpleCheckinFormContent type={type} />
    </LanguageProvider>
  );
}
