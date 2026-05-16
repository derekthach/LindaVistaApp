'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/LanguageToggle';
import type { TranslationKey } from '@/components/LanguageToggle';
import { getDraft, clearDraft } from '@/lib/checkins/draft';
import type { FoodBeerDraft } from '@/lib/checkins/draft';
import { confirmFoodBeerCheckinAction } from '@/app/actions/checkin';
import { formatTime } from '@/lib/utils/formatTime';
import { getPaymentMethodTranslationKey, hasStoredPaymentMethodSingle } from '@/lib/checkins/paymentMethods';

function centsToCurrency(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-PR' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function ValidateContent({
  type,
  staffDisplayOverride,
}: {
  type: 'food' | 'beer';
  staffDisplayOverride?: string;
}) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [draft, setDraft] = useState<FoodBeerDraft | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = getDraft(type);
    if (!d) {
      router.replace(`/checkins/new/${type}`);
      return;
    }
    setDraft(d);
  }, [type, router]);

  const handleConfirm = async () => {
    if (!draft) return;
    setError(null);
    setConfirming(true);
    try {
      const result = await confirmFoodBeerCheckinAction(draft);
      if (result?.error) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      clearDraft(type);
      router.push('/checkins/new');
    } catch (err) {
      setError(t('verify_generic_error'));
      setConfirming(false);
    }
  };

  const handleCancel = () => {
    router.push(`/checkins/new/${type}`);
  };

  if (!draft) {
    return <div className="card">{t('loading')}</div>;
  }

  const totalCents = draft.lineItems.reduce(
    (sum, item) => sum + Math.round((item.amountCollected ?? 0) * 100),
    0
  );
  const typeLabel = type === 'food' ? t('food_and_beverage') : t('beer');

  return (
    <div className="card">
      <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong>{t('label_type')}:</strong>
          <span>{typeLabel}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong>{t('date')}:</strong>
          <span>{draft.date}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong>{t('time')}:</strong>
          <span>{formatTime(draft.time) || draft.time}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong>{t('staff_name')}:</strong>
          <span>{staffDisplayOverride ?? draft.staff_name}</span>
        </div>

        <div style={{ marginTop: 8 }}>
          <strong>{t('items')}:</strong>
          <table style={{ width: '100%', marginTop: 8, borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}>{t('item')}</th>
                <th style={{ padding: '6px 8px' }}>{t('quantity_sold')}</th>
                <th style={{ padding: '6px 8px' }}>{t('amount_collected')}</th>
              </tr>
            </thead>
            <tbody>
              {draft.lineItems.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 8px' }}>{item.itemLabel}</td>
                  <td style={{ padding: '6px 8px' }}>{item.quantitySold}</td>
                  <td style={{ padding: '6px 8px' }}>
                    ${Number(item.amountCollected).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <strong>{t('total_amount_collected')}:</strong>
          <span>{centsToCurrency(totalCents, language)}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong>{t('payment_method')}:</strong>
          <span>
            {hasStoredPaymentMethodSingle(draft.payment_method)
              ? t(getPaymentMethodTranslationKey(draft.payment_method) as TranslationKey)
              : t('payment_method_not_recorded')}
          </span>
        </div>

        {draft.notes && (
          <div style={{ marginTop: 8 }}>
            <strong>{t('notes')}:</strong>
            <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{draft.notes}</div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ marginBottom: 12, fontSize: 14, color: '#b91c1c' }}>{t(error as TranslationKey)}</div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={handleCancel}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #d1d5db',
            background: '#fff',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={confirming}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            background: '#166534',
            color: '#fff',
            fontWeight: 600,
            cursor: confirming ? 'not-allowed' : 'pointer',
            opacity: confirming ? 0.7 : 1,
          }}
        >
          {confirming ? t('saving') : t('confirm')}
        </button>
      </div>
    </div>
  );
}

export default function FoodBeerValidateClient({
  type,
  staffDisplayOverride,
}: {
  type: 'food' | 'beer';
  staffDisplayOverride?: string;
}) {
  return <ValidateContent type={type} staffDisplayOverride={staffDisplayOverride} />;
}
