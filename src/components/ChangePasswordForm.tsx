'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { logoutAction } from '@/app/actions/auth';
import { changeEmployeePasswordAction } from '@/app/actions/employeePassword';
import { useTranslation } from '@/lib/i18n/useTranslation';

function SubmitButton() {
  const { pending } = useFormStatus();
  const { t } = useTranslation();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        border: 'none',
        background: pending ? '#9ca3af' : '#166534',
        color: '#fff',
        fontWeight: 600,
        cursor: pending ? 'not-allowed' : 'pointer',
      }}
    >
      {pending ? t('saving_password') : t('save_password')}
    </button>
  );
}

export default function ChangePasswordForm() {
  const { t } = useTranslation();
  const [state, formAction] = useActionState(changeEmployeePasswordAction, undefined);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <form action={formAction} style={{ display: 'grid', gap: 14 }}>
        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('new_password')}</div>
          <input
            name="newPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
          />
        </label>
        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('confirm_password')}</div>
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
          />
        </label>
        {state?.error && (
          <div style={{ color: '#b91c1c', fontSize: 14 }} role="alert">
            {state.error}
          </div>
        )}
        <SubmitButton />
      </form>
      <form action={logoutAction}>
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #d1d5db',
            background: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('logout')}
        </button>
      </form>
    </div>
  );
}
