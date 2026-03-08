'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/LanguageToggle';
import { getStaffOptionsForRole } from '@/lib/checkins/constants';
import StaffPasswordModal from './StaffPasswordModal';

const STAFF_REQUIRING_PASSWORD = 'Derek Thach';

interface StaffDropdownProps {
  name?: string;
  required?: boolean;
  'aria-label'?: string;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  /** When false (employee), Keith Thach and Duyen Thach are excluded; selecting Derek Thach requires password. Default true = show all. */
  isAdmin?: boolean;
}

export default function StaffDropdown({
  name = 'staff_name',
  required = true,
  'aria-label': ariaLabel,
  value,
  onChange,
  onBlur,
  isAdmin = true,
}: StaffDropdownProps) {
  const { t } = useLanguage();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const controlled = value !== undefined;
  const staffOptions = getStaffOptionsForRole(isAdmin);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    if (!isAdmin && newValue === STAFF_REQUIRING_PASSWORD) {
      setShowPasswordModal(true);
      return;
    }
    onChange?.(newValue);
  };

  const handlePasswordSuccess = () => {
    onChange?.(STAFF_REQUIRING_PASSWORD);
    setShowPasswordModal(false);
  };

  return (
    <>
      <label>
        <div>{t('staff_name')}</div>
        <select
          name={name}
          required={required}
          aria-label={ariaLabel ?? t('staff_name')}
          value={controlled ? value : undefined}
          onChange={handleSelectChange}
          onBlur={onBlur}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
        >
          <option value="">{t('staff_select_placeholder')}</option>
          {staffOptions.map((staff) => (
            <option key={staff} value={staff}>
              {staff}
            </option>
          ))}
        </select>
      </label>
      <StaffPasswordModal
        open={showPasswordModal}
        staffName={STAFF_REQUIRING_PASSWORD}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={handlePasswordSuccess}
      />
    </>
  );
}
