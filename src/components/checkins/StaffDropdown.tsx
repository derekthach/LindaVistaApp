'use client';

import { useLanguage } from '@/components/LanguageToggle';
import { STAFF_MEMBERS } from '@/lib/checkins/constants';

interface StaffDropdownProps {
  name?: string;
  required?: boolean;
  'aria-label'?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export default function StaffDropdown({
  name = 'staff_name',
  required = true,
  'aria-label': ariaLabel,
  value,
  onChange,
}: StaffDropdownProps) {
  const { t } = useLanguage();
  const controlled = value !== undefined;

  return (
    <label>
      <div>{t('staff_name')}</div>
      <select
        name={name}
        required={required}
        aria-label={ariaLabel ?? t('staff_name')}
        value={controlled ? value : undefined}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
      >
        <option value="">{t('staff_select_placeholder')}</option>
        {STAFF_MEMBERS.map((staff) => (
          <option key={staff} value={staff}>
            {staff}
          </option>
        ))}
      </select>
    </label>
  );
}
