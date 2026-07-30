'use client';

import { useCallback } from 'react';
import { PAYMENT_METHODS, getPaymentMethodTranslationKey } from '@/lib/checkins/paymentMethods';
import {
  calculatePaymentSplitTotal,
  roundMoney,
  type PaymentSplitFormRow,
  validatePaymentSplits,
  type ValidatePaymentSplitsOptions,
  type ValidatePaymentSplitsResult,
} from '@/lib/checkins/roomPaymentSplits';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { TranslationKey } from '@/lib/i18n/translations';

const defaultInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 14,
};

export type PaymentSplitsEditorProps = {
  value: PaymentSplitFormRow[];
  onChange: (rows: PaymentSplitFormRow[]) => void;
  /** When set, live total uses validated splits; invalid rows show "—". */
  validation?: ValidatePaymentSplitsResult;
  validateOptions?: ValidatePaymentSplitsOptions;
  showError?: boolean;
  /** Override displayed error (e.g. mismatch message with amounts). */
  errorMessage?: string;
  onBlur?: () => void;
  inputStyle?: React.CSSProperties;
  titleKey?: TranslationKey;
  totalLabelKey?: TranslationKey;
  /** Max amount attribute on number inputs (defaults from validateOptions or 1000). */
  amountInputMax?: number;
  /**
   * When set, show Check-In Total / Payment Total / Remaining under the rows
   * (food/beer forms where line items define the expected total).
   */
  expectedTotal?: number;
};

/**
 * Shared multi-payment row editor used by room check-in, past entry, and edit modals.
 */
export default function PaymentSplitsEditor({
  value,
  onChange,
  validation: validationProp,
  validateOptions,
  showError = false,
  errorMessage,
  onBlur,
  inputStyle = defaultInputStyle,
  titleKey = 'payment_breakdown',
  totalLabelKey = 'total_collected',
  amountInputMax,
  expectedTotal,
}: PaymentSplitsEditorProps) {
  const { t } = useTranslation();

  const validation =
    validationProp ??
    validatePaymentSplits(
      JSON.stringify(
        value.map((r) => ({
          method: r.method,
          amount: r.amount.trim() === '' ? '' : Number(r.amount),
        }))
      ),
      validateOptions
    );

  const assignedFromRows = roundMoney(
    value.reduce((sum, r) => {
      const n = Number(r.amount);
      return sum + (Number.isFinite(n) && n > 0 ? n : 0);
    }, 0)
  );
  const liveTotal =
    validation.valid && validation.splits
      ? calculatePaymentSplitTotal(validation.splits)
      : assignedFromRows > 0
        ? assignedFromRows
        : null;

  const expectedRounded =
    expectedTotal != null && Number.isFinite(expectedTotal) ? roundMoney(expectedTotal) : null;
  const remaining =
    expectedRounded != null && liveTotal != null
      ? roundMoney(expectedRounded - liveTotal)
      : expectedRounded != null
        ? expectedRounded
        : null;

  const maxAttr = amountInputMax ?? validateOptions?.maxRowAmount ?? 1000;

  const updateRow = useCallback(
    (index: number, patch: Partial<PaymentSplitFormRow>) => {
      onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    },
    [onChange, value]
  );

  const addRow = useCallback(() => {
    const used = new Set(value.map((r) => r.method));
    const next = PAYMENT_METHODS.find((m) => !used.has(m));
    if (!next) return;
    onChange([...value, { method: next, amount: '' }]);
  }, [onChange, value]);

  const removeRow = useCallback(
    (index: number) => {
      if (value.length <= 1) return;
      onChange(value.filter((_, i) => i !== index));
    },
    [onChange, value]
  );

  const resolvedError =
    errorMessage ??
    (validation.error === 'err_payment_total_mismatch' &&
    validation.expectedTotal != null &&
    validation.assignedTotal != null
      ? t('err_payment_total_mismatch', {
          expected: validation.expectedTotal.toFixed(2),
          assigned: validation.assignedTotal.toFixed(2),
          remaining: Math.max(
            0,
            roundMoney(validation.expectedTotal - validation.assignedTotal)
          ).toFixed(2),
        })
      : validation.error
        ? t(validation.error as TranslationKey)
        : '');

  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{t(titleKey)}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {value.map((row, idx) => {
          const usedElsewhere = new Set(value.filter((_, i) => i !== idx).map((r) => r.method));
          return (
            <div
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(140px, 1fr) minmax(100px, 1fr) auto',
                gap: 8,
                alignItems: 'end',
              }}
            >
              <label style={{ margin: 0 }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{t('payment_method')}</div>
                <select
                  value={row.method}
                  onChange={(e) => updateRow(idx, { method: e.target.value })}
                  onBlur={onBlur}
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
                  max={maxAttr}
                  value={row.amount}
                  onChange={(e) => updateRow(idx, { amount: e.target.value })}
                  onBlur={onBlur}
                  style={inputStyle}
                />
              </label>
              <button
                type="button"
                onClick={() => removeRow(idx)}
                disabled={value.length <= 1}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  background: value.length <= 1 ? '#f3f4f6' : '#fff',
                  cursor: value.length <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: 13,
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
        onClick={addRow}
        disabled={value.length >= PAYMENT_METHODS.length}
        style={{
          marginTop: 10,
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid #166534',
          background: '#fff',
          color: '#166534',
          fontWeight: 600,
          cursor: value.length >= PAYMENT_METHODS.length ? 'not-allowed' : 'pointer',
          fontSize: 13,
        }}
      >
        {t('add_payment_method')}
      </button>
      {expectedRounded != null ? (
        <div style={{ marginTop: 12, display: 'grid', gap: 4, fontSize: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{t('check_in_total')}</span>
            <span style={{ fontWeight: 600 }}>${expectedRounded.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{t('payment_total')}</span>
            <span style={{ fontWeight: 600 }}>{liveTotal != null ? `$${liveTotal.toFixed(2)}` : '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{t('payment_remaining')}</span>
            <span style={{ fontWeight: 600 }}>
              {remaining != null ? `$${remaining.toFixed(2)}` : '—'}
            </span>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12, fontSize: 15, fontWeight: 600 }}>
          {t(totalLabelKey)}: {liveTotal != null ? `$${liveTotal.toFixed(2)}` : '—'}
        </div>
      )}
      {showError && resolvedError ? (
        <div style={{ color: '#dc2626', fontSize: 12, marginTop: 6 }}>{resolvedError}</div>
      ) : null}
    </div>
  );
}
