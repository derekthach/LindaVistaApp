'use client';

import { useActionState, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TranslationKey } from '@/lib/i18n/translations';
import { useTranslation } from '@/lib/i18n/useTranslation';
import Button from '@/components/Button';
import type { ItemOption } from '@/lib/checkins/items';
import { PAYMENT_METHODS, getPaymentMethodTranslationKey } from '@/lib/checkins/paymentMethods';
import { validateSimpleCheckin } from '@/lib/checkins/validation';
import type { LineItem } from '@/types';
import { QuantitySoldInput } from '@/components/checkins/QuantitySoldInput';

const QUANTITY_MAX = 50;

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 14,
};

const initialRow = (): LineItem => ({
  itemId: '',
  itemLabel: '',
  quantitySold: 1,
  amountCollected: 0,
});

type ActionState = { error?: string; ok?: boolean; id?: string };

export default function PastFoodBeerMultiRowForm({
  staffNames,
  itemOptions,
  checkInType,
  submitAction,
  introKey,
  savedKey,
  submitLabelKey,
  reloadTabQuery,
}: {
  staffNames: string[];
  itemOptions: ItemOption[];
  checkInType: 'food' | 'beer';
  submitAction: (prev: unknown, formData: FormData) => Promise<ActionState>;
  introKey: TranslationKey;
  savedKey: TranslationKey;
  submitLabelKey: TranslationKey;
  reloadTabQuery: 'food' | 'beer';
}) {
  const { t, language } = useTranslation();
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(submitAction, {});

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [staffName, setStaffName] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [lineRows, setLineRows] = useState<LineItem[]>([initialRow()]);
  const [submitAttempted, setSubmitAttempted] = useState(false);

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
        checkInType,
        lineItems: lineItemsForValidation,
        notes: notes || undefined,
        payment_method: paymentMethod,
      }),
    [date, time, staffName, checkInType, lineItemsForValidation, notes, paymentMethod]
  );

  const displayErrors = validation.errors;
  const displayLineItemErrors = validation.lineItemErrors ?? {};

  const totalAmountCollected = useMemo(
    () => lineRows.reduce((sum, r) => sum + (Number(r.amountCollected) || 0), 0),
    [lineRows]
  );

  const formOk = validation.valid;

  const msg = (code: string) => t(code as TranslationKey);

  const cardStyle: React.CSSProperties = {
    width: '100%',
    padding: 24,
    display: 'grid',
    gap: 16,
  };

  const fieldGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 14,
    alignItems: 'start',
  };

  if (state?.ok) {
    return (
      <div className="card" style={cardStyle}>
        <p style={{ margin: '0 0 12px', color: '#166534', fontWeight: 600 }}>{t(savedKey)}</p>
        <Button variant="primary" onClick={() => router.push('/checkins')}>
          {t('past_room_view_checkins')}
        </Button>
        <div style={{ marginTop: 12 }}>
          <Button
            variant="ghost"
            onClick={() => {
              window.location.assign(`/admin/add-past-entry?tab=${reloadTabQuery}`);
            }}
          >
            {t('past_room_add_another')}
          </Button>
        </div>
      </div>
    );
  }

  const linePayload: LineItem[] = lineRows
    .filter((r) => r.itemId?.trim())
    .map((r) => ({
      itemId: r.itemId,
      itemLabel: r.itemLabel,
      quantitySold: Math.min(QUANTITY_MAX, Math.max(1, Math.floor(Number(r.quantitySold) || 1))),
      amountCollected: Number(r.amountCollected) ?? 0,
    }));

  return (
    <div className="card" style={cardStyle}>
      <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.5, textAlign: 'center' }}>
        {t(introKey)}
      </p>

      {(state?.error || (submitAttempted && !formOk)) && (
        <div style={{ padding: 12, backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 14 }}>
          {state?.error ??
            (submitAttempted && !formOk ? t('fix_errors_below' as TranslationKey) : '')}
        </div>
      )}

      <form
        action={formAction}
        onSubmit={() => setSubmitAttempted(true)}
        style={{ display: 'grid', gap: 14 }}
      >
        <input type="hidden" name="lineItems" value={JSON.stringify(linePayload)} />

        <div style={fieldGridStyle}>
          <label style={{ margin: 0, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('date')}</div>
            <input
              type="date"
              name="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle}
              required
            />
            {submitAttempted && displayErrors.date && (
              <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{msg(displayErrors.date)}</div>
            )}
          </label>
          <label style={{ margin: 0, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('time')}</div>
            <input
              type="time"
              name="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={inputStyle}
              required
            />
            {submitAttempted && displayErrors.time && (
              <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{msg(displayErrors.time)}</div>
            )}
          </label>
        </div>

        <label style={{ margin: 0, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
            {t('past_room_field_staff_attribution')}
          </div>
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
          {submitAttempted && displayErrors.staff_name && (
              <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>
              {msg(displayErrors.staff_name)}
              </div>
            )}
        </label>

        <div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, fontWeight: 600 }}>{t('items')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {lineRows.map((row, index) => (
              <div
                key={index}
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
                    onChange={(e) => handleItemSelect(index, e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">{t('item_select_placeholder')}</option>
                    {itemOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {getItemLabel(opt)}
                      </option>
                    ))}
                  </select>
                  {submitAttempted && displayLineItemErrors[index]?.itemId && (
                    <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>
                      {msg(displayLineItemErrors[index].itemId!)}
                    </div>
                  )}
                </label>
                <label style={{ margin: 0, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('quantity_sold')}</div>
                  <QuantitySoldInput
                    value={row.quantitySold}
                    onChange={(n) => updateRow(index, 'quantitySold', n)}
                    min={1}
                    max={QUANTITY_MAX}
                    style={inputStyle}
                  />
                  {submitAttempted && displayLineItemErrors[index]?.quantitySold && (
                    <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>
                      {msg(displayLineItemErrors[index].quantitySold!)}
                    </div>
                  )}
                </label>
                <label style={{ margin: 0, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('amount_collected')}</div>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    max={1000}
                    value={row.amountCollected === 0 ? '' : row.amountCollected}
                    onChange={(e) =>
                      updateRow(index, 'amountCollected', parseFloat(e.target.value) || 0)
                    }
                    style={inputStyle}
                  />
                  {submitAttempted && displayLineItemErrors[index]?.amountCollected && (
                    <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>
                      {msg(displayLineItemErrors[index].amountCollected!)}
                    </div>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => removeRow(index)}
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
            onClick={addRow}
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
            }).format(totalAmountCollected)}
          </div>
          {submitAttempted && displayErrors.lineItems && (
            <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{msg(displayErrors.lineItems)}</div>
          )}
          {submitAttempted && displayErrors.itemsTotal && (
            <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{msg(displayErrors.itemsTotal)}</div>
          )}
        </div>

        <label style={{ margin: 0, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('payment_method')}</div>
          <select
            name="payment_method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
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
          {submitAttempted && displayErrors.payment_method && (
            <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>
              {msg(displayErrors.payment_method)}
            </div>
          )}
        </label>

        <label style={{ margin: 0 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('notes')}</div>
          <textarea
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }}
            maxLength={250}
          />
          {submitAttempted && displayErrors.notes && (
            <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{msg(displayErrors.notes)}</div>
          )}
        </label>

        <Button type="submit" variant="primary" disabled={isPending || !formOk}>
          {isPending ? t('saving_confirm') : t(submitLabelKey)}
        </Button>
      </form>
    </div>
  );
}
