'use client';

import type { CSSProperties } from 'react';
import type { CheckIn } from '@/types';
import type { TranslationKey } from '@/lib/i18n/translations';
import { getCheckInPaymentMethodValues } from '@/lib/checkins/paymentMethods';

const tagStyle: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 999,
  background: '#f3f4f6',
  color: '#374151',
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.35,
  whiteSpace: 'nowrap',
};

const wrapStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  alignItems: 'center',
};

/**
 * Compact payment-method pills for check-in tables.
 * Supports legacy single `payment_method` and multi `payment_splits`.
 * Missing/invalid data shows an em dash (not "Unpaid").
 */
export default function PaymentMethodTags({
  checkin,
  t,
}: {
  checkin: Pick<CheckIn, 'payment_method' | 'payment_splits'>;
  t: (key: TranslationKey) => string;
}) {
  const methods = getCheckInPaymentMethodValues(checkin);
  if (methods.length === 0) {
    return <span aria-hidden="true">—</span>;
  }
  return (
    <div style={wrapStyle}>
      {methods.map((method) => (
        <span key={method} style={tagStyle}>
          {t(method as TranslationKey)}
        </span>
      ))}
    </div>
  );
}
