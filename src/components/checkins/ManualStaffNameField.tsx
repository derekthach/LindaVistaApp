'use client';

import type { CSSProperties } from 'react';
import { useLanguage } from '@/components/LanguageToggle';
import type { TranslationKey } from '@/lib/i18n/translations';

const DEFAULT_MAX = 80;

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 14,
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  /** Subtle hint for the shared Guest login account */
  showGuestHint?: boolean;
  errorText?: string | null;
  maxLength?: number;
};

export default function ManualStaffNameField({
  value,
  onChange,
  onBlur,
  name = 'staff_name',
  showGuestHint,
  errorText,
  maxLength = DEFAULT_MAX,
}: Props) {
  const { t } = useLanguage();

  return (
    <label style={{ display: 'block' }}>
      <div>{t('staff_name')}</div>
      {showGuestHint ? (
        <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 6px', lineHeight: 1.4 }}>
          {t('guest_account_staff_hint')}
        </p>
      ) : null}
      <input
        type="text"
        name={name}
        value={value}
        onChange={(e) => {
          let v = e.target.value;
          if (v.length > maxLength) v = v.slice(0, maxLength);
          onChange(v);
        }}
        onBlur={onBlur}
        autoComplete="off"
        spellCheck={false}
        style={inputStyle}
        aria-invalid={Boolean(errorText)}
      />
      {errorText ? (
        <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{t(errorText as TranslationKey)}</div>
      ) : null}
    </label>
  );
}
