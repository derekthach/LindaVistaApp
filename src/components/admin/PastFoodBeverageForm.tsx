'use client';

import { useActionState, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitPastFoodBeverageAction } from '@/app/actions/pastFoodBeverage';
import Button from '@/components/Button';
import { FOOD_ITEMS } from '@/lib/checkins/items';
import type { ItemOption } from '@/lib/checkins/items';
import { PAYMENT_METHODS } from '@/lib/checkins/paymentMethods';
import { getPaymentMethodTranslationKey } from '@/lib/checkins/paymentMethods';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { TranslationKey } from '@/lib/i18n/translations';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 14,
};

const QUANTITY_MAX = 50;
const AMOUNT_MAX = 1000;

export default function PastFoodBeverageForm({ staffNames }: { staffNames: string[] }) {
  const { t, language } = useTranslation();
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(submitPastFoodBeverageAction, {});

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [staffName, setStaffName] = useState('');
  const [itemId, setItemId] = useState('');
  const [itemLabel, setItemLabel] = useState('');
  const [quantity, setQuantity] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');

  const itemOptions: ItemOption[] = FOOD_ITEMS;

  const getItemLabel = useCallback(
    (item: ItemOption) => (language === 'es' ? item.label.es : item.label.en),
    [language]
  );

  const handleItemSelect = useCallback(
    (selectedItemId: string) => {
      if (!selectedItemId) {
        setItemId('');
        setItemLabel('');
        return;
      }
      const option = itemOptions.find((o) => o.id === selectedItemId);
      if (!option) return;
      setItemId(selectedItemId);
      setItemLabel(getItemLabel(option));
    },
    [itemOptions, getItemLabel]
  );

  const qtyNum = quantity.trim() === '' ? NaN : Math.floor(Number(quantity));
  const qtyValid =
    !Number.isNaN(qtyNum) && Number.isInteger(qtyNum) && qtyNum >= 1 && qtyNum <= QUANTITY_MAX;
  const amtNum = amount.trim() === '' ? NaN : Number(amount);
  const amtValid = !Number.isNaN(amtNum) && amtNum > 0 && amtNum <= AMOUNT_MAX;

  const formOk =
    Boolean(date && time && staffName.trim() && itemId.trim() && qtyValid && amtValid && paymentMethod);

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
        <p style={{ margin: '0 0 12px', color: '#166534', fontWeight: 600 }}>{t('past_entry_food_saved')}</p>
        <Button variant="primary" onClick={() => router.push('/checkins')}>
          {t('past_room_view_checkins')}
        </Button>
        <div style={{ marginTop: 12 }}>
          <Button
            variant="ghost"
            onClick={() => {
              window.location.assign('/admin/add-past-entry?tab=food');
            }}
          >
            {t('past_room_add_another')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={cardStyle}>
      <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.5, textAlign: 'center' }}>
        {t('past_entry_food_intro')}
      </p>

      {state?.error && (
        <div style={{ padding: 12, backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 14 }}>
          {state.error}
        </div>
      )}

      <form action={formAction} style={{ display: 'grid', gap: 14 }}>
        <input type="hidden" name="item_id" value={itemId} />
        <input type="hidden" name="item_label" value={itemLabel} />

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
          </label>
        </div>

        <div style={fieldGridStyle}>
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
          </label>

          <label style={{ margin: 0, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('item')}</div>
            <select
              value={itemId}
              onChange={(e) => handleItemSelect(e.target.value)}
              style={inputStyle}
              required
            >
              <option value="">{t('item_select_placeholder')}</option>
              {itemOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {getItemLabel(opt)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={fieldGridStyle}>
          <label style={{ margin: 0, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('quantity_sold')}</div>
            <input
              type="number"
              name="quantity_sold"
              min={1}
              max={QUANTITY_MAX}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              style={inputStyle}
              required
            />
          </label>
          <label style={{ margin: 0, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('amount_collected')}</div>
            <input
              type="number"
              name="amount_collected"
              min={0.01}
              step="0.01"
              max={AMOUNT_MAX}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={inputStyle}
              required
            />
          </label>
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
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {t(getPaymentMethodTranslationKey(method) as TranslationKey)}
              </option>
            ))}
          </select>
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
        </label>

        <Button type="submit" variant="primary" disabled={isPending || !formOk}>
          {isPending ? t('saving_confirm') : t('submit')}
        </Button>
      </form>
    </div>
  );
}
