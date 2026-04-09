'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { adminResetEmployeePasswordAction } from '@/app/actions/employeesAdmin';
import { LV_PENDING_RESETS_INVALIDATE } from '@/lib/adminNavEvents';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { TranslationKey } from '@/lib/i18n/translations';

export type EmployeeTableRow = {
  id: string;
  fullName: string;
  username: string;
  role: string;
  status: string;
  mustChangePassword: boolean;
  passwordResetRequested: boolean;
  lastLoginAt: string | null;
};

function ResetSubmit() {
  const { pending } = useFormStatus();
  const { t } = useTranslation();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: '8px 14px',
        borderRadius: 8,
        border: 'none',
        background: pending ? '#9ca3af' : '#166534',
        color: '#fff',
        fontWeight: 600,
        cursor: pending ? 'not-allowed' : 'pointer',
      }}
    >
      {pending ? t('saving_password') : t('set_password')}
    </button>
  );
}

function ResetPasswordModal({
  user,
  onClose,
}: {
  user: EmployeeTableRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [state, formAction] = useActionState(adminResetEmployeePasswordAction, undefined as
    | { error?: string; ok?: boolean }
    | undefined);
  const successHandledRef = useRef(false);

  useEffect(() => {
    if (!state?.ok || successHandledRef.current) return;
    successHandledRef.current = true;
    window.dispatchEvent(new CustomEvent(LV_PENDING_RESETS_INVALIDATE));
    router.refresh();
    const timer = window.setTimeout(() => {
      onClose();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [state?.ok, onClose, router]);

  const handleClose = () => {
    if (state?.ok) {
      window.dispatchEvent(new CustomEvent(LV_PENDING_RESETS_INVALIDATE));
      router.refresh();
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="card" style={{ width: '100%', maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>{t('reset_password_modal_title')}</h2>
        <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: 14 }}>
          {t('reset_password_modal_intro', { name: user.fullName, username: user.username })}
        </p>
        <form action={formAction} style={{ display: 'grid', gap: 12 }}>
          <input type="hidden" name="userId" value={user.id} />
          <label>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('new_temporary_password')}</div>
            <input
              name="newPassword"
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
          {state?.ok && <div style={{ color: '#166534', fontSize: 14 }}>{t('password_updated')}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              {t('close')}
            </button>
            {!state?.ok && <ResetSubmit />}
          </div>
        </form>
      </div>
    </div>
  );
}

function translateRole(role: string, t: (k: TranslationKey) => string) {
  const r = role.toLowerCase();
  if (r === 'admin') return t('employees_role_admin');
  if (r === 'employee') return t('employees_role_employee');
  return role;
}

function translateUserStatus(status: string, t: (k: TranslationKey) => string) {
  const s = status.toLowerCase();
  if (s === 'active') return t('employees_status_active');
  if (s === 'inactive') return t('employees_status_inactive');
  return status;
}

export default function EmployeesAdminClient({
  users,
  pendingResetCount,
}: {
  users: EmployeeTableRow[];
  pendingResetCount: number;
}) {
  const { t, language } = useTranslation();
  const [resetUser, setResetUser] = useState<EmployeeTableRow | null>(null);
  const dismissResetModal = useCallback(() => setResetUser(null), []);

  return (
    <>
      <div
        style={{
          marginBottom: 20,
          padding: 12,
          background: pendingResetCount > 0 ? '#fef3c7' : '#f3f4f6',
          borderRadius: 8,
          fontWeight: 600,
        }}
      >
        {t('employees_pending_resets')}: {pendingResetCount}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
              <th style={{ padding: '10px 8px' }}>{t('employees_col_name')}</th>
              <th style={{ padding: '10px 8px' }}>{t('employees_col_username')}</th>
              <th style={{ padding: '10px 8px' }}>{t('employees_col_role')}</th>
              <th style={{ padding: '10px 8px' }}>{t('employees_col_status')}</th>
              <th style={{ padding: '10px 8px' }}>{t('employees_col_password_status')}</th>
              <th style={{ padding: '10px 8px' }}>{t('employees_col_reset')}</th>
              <th style={{ padding: '10px 8px' }}>{t('employees_col_last_login')}</th>
              <th style={{ padding: '10px 8px' }}>{t('employees_col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 8px' }}>{u.fullName}</td>
                <td style={{ padding: '10px 8px' }}>{u.username}</td>
                <td style={{ padding: '10px 8px' }}>{translateRole(u.role, t)}</td>
                <td style={{ padding: '10px 8px' }}>{translateUserStatus(u.status, t)}</td>
                <td style={{ padding: '10px 8px' }}>
                  {u.mustChangePassword ? t('password_status_must_change') : t('password_status_active')}
                </td>
                <td style={{ padding: '10px 8px' }}>
                  {u.passwordResetRequested ? (
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: '#fef08a',
                        color: '#854d0e',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {t('reset_requested')}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                  {u.lastLoginAt
                    ? new Date(u.lastLoginAt).toLocaleString(language === 'es' ? 'es-PR' : 'en-US')
                    : '—'}
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <button
                    type="button"
                    onClick={() => setResetUser(u)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: '1px solid #166534',
                      background: '#fff',
                      color: '#166534',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    {t('reset_password')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetUser && (
        <ResetPasswordModal key={resetUser.id} user={resetUser} onClose={dismissResetModal} />
      )}
    </>
  );
}
