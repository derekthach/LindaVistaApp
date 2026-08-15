'use client';

import type { CSSProperties } from 'react';
import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  adminAddEmployeeAction,
  adminResetEmployeePasswordAction,
  adminSaveEmployeesBulkAction,
  adminSoftDeleteEmployeeAction,
} from '@/app/actions/employeesAdmin';
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
  firestoreBacked: boolean;
};

const btnSolid: CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: 'none',
  background: '#166534',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 14,
};

const btnMuted: CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  background: '#fff',
  color: '#374151',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 14,
};

const btnPrimaryOutline: CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid #166534',
  background: '#fff',
  color: '#166534',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 14,
};

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

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

function AddEmployeeSubmit() {
  const { pending } = useFormStatus();
  const { t } = useTranslation();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        ...btnSolid,
        background: pending ? '#9ca3af' : '#166534',
        cursor: pending ? 'not-allowed' : 'pointer',
      }}
    >
      {pending ? t('employees_add_saving') : t('employees_add_submit')}
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
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" onClick={handleClose} style={btnMuted}>
              {t('close')}
            </button>
            {!state?.ok && <ResetSubmit />}
          </div>
        </form>
      </div>
    </div>
  );
}

function AddEmployeeModal({ onClose, onSuccessMessage }: { onClose: () => void; onSuccessMessage: () => void }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [usernameField, setUsernameField] = useState('');
  const [state, formAction] = useActionState(adminAddEmployeeAction, undefined as
    | { error?: string; ok?: boolean }
    | undefined);
  const successHandledRef = useRef(false);

  useEffect(() => {
    if (!state?.ok || successHandledRef.current) return;
    successHandledRef.current = true;
    router.refresh();
    onSuccessMessage();
    const timer = window.setTimeout(() => onClose(), 400);
    return () => window.clearTimeout(timer);
  }, [state?.ok, onClose, onSuccessMessage, router]);

  const handleBackdrop = () => {
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-employee-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 85,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && handleBackdrop()}
    >
      <div className="card" style={{ width: '100%', maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <h2 id="add-employee-title" style={{ margin: '0 0 8px', fontSize: 18 }}>
          {t('employees_add_modal_title')}
        </h2>
        <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: 14 }}>
          {t('employees_add_modal_intro')}
        </p>
        <form action={formAction} style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>{t('employees_field_full_name')}</span>
            <input
              name="fullName"
              required
              autoComplete="name"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
            />
          </label>
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>{t('employees_field_username')}</span>
            <input
              name="username"
              required
              autoComplete="username"
              value={usernameField}
              onChange={(e) => setUsernameField(e.target.value.toLowerCase())}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
            />
            <span style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.35 }}>{t('employees_username_lowercase_hint')}</span>
          </div>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>{t('employees_field_status')}</span>
            <select
              name="status"
              defaultValue="active"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
            >
              <option value="active">{t('employees_status_active')}</option>
              <option value="inactive">{t('employees_status_inactive')}</option>
            </select>
          </label>
          {state?.error && (
            <div style={{ color: '#b91c1c', fontSize: 14 }} role="alert">
              {state.error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" onClick={onClose} style={btnMuted}>
              {t('close')}
            </button>
            {!state?.ok && <AddEmployeeSubmit />}
          </div>
        </form>
      </div>
    </div>
  );
}

function EditEmployeeModal({
  user,
  onClose,
  onSaved,
}: {
  user: EmployeeTableRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [fullName, setFullName] = useState(user.fullName);
  const [status, setStatus] = useState<'active' | 'inactive'>(normalizeStatus(user.status));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(user.fullName);
    setStatus(normalizeStatus(user.status));
    setError(null);
  }, [user]);

  const save = async () => {
    const name = fullName.trim();
    if (!name) {
      setError(t('employees_error_empty_name'));
      return;
    }
    setError(null);
    setPending(true);
    const fd = new FormData();
    fd.set('updates', JSON.stringify([{ id: user.id, fullName: name, status }]));
    try {
      const res = await adminSaveEmployeesBulkAction(fd);
      if (res.ok) {
        router.refresh();
        onSaved();
        onClose();
      } else {
        setError(res.error ?? t('employees_error_generic'));
      }
    } catch {
      setError(t('employees_error_generic'));
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-employee-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 86,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && !pending && onClose()}
    >
      <div className="card" style={{ width: '100%', maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <h2 id="edit-employee-title" style={{ margin: '0 0 8px', fontSize: 18 }}>
          {t('employees_edit_modal_title')}
        </h2>
        <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: 14 }}>
          {user.fullName} <span style={{ color: '#9ca3af' }}>({user.username})</span>
        </p>
        <div style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>{t('employees_field_full_name')}</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
            />
          </label>
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>{t('employees_field_username')}</span>
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                background: '#f9fafb',
                color: '#374151',
              }}
            >
              {user.username}
            </div>
          </div>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>{t('employees_field_status')}</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value === 'inactive' ? 'inactive' : 'active')}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
            >
              <option value="active">{t('employees_status_active')}</option>
              <option value="inactive">{t('employees_status_inactive')}</option>
            </select>
          </label>
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>{t('employees_col_role')}</span>
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                background: '#f9fafb',
                color: '#374151',
              }}
            >
              {translateRole(user.role, t)}
            </div>
          </div>
          {error && (
            <div style={{ color: '#b91c1c', fontSize: 14 }} role="alert">
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" disabled={pending} onClick={onClose} style={btnMuted}>
              {t('employees_cancel')}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => void save()}
              style={{
                ...btnSolid,
                background: pending ? '#9ca3af' : '#166534',
                cursor: pending ? 'not-allowed' : 'pointer',
              }}
            >
              {pending ? t('employees_save_saving') : t('employees_save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  user,
  onClose,
  onDone,
}: {
  user: EmployeeTableRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setError(null);
    setPending(true);
    const fd = new FormData();
    fd.set('userId', user.id);
    try {
      const res = await adminSoftDeleteEmployeeAction(fd);
      if (res.ok) {
        window.dispatchEvent(new CustomEvent(LV_PENDING_RESETS_INVALIDATE));
        router.refresh();
        onDone();
        onClose();
      } else {
        setError(res.error ?? t('employees_error_generic'));
      }
    } catch {
      setError(t('employees_error_generic'));
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && !pending && onClose()}
    >
      <div className="card" style={{ width: '100%', maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>{t('employees_delete_confirm_title')}</h2>
        <p style={{ margin: '0 0 12px', color: '#374151', fontSize: 14, lineHeight: 1.5 }}>
          {t('employees_delete_confirm_body')}
        </p>
        <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: 14 }}>
          <strong>{user.fullName}</strong> ({user.username})
        </p>
        {error && (
          <div style={{ color: '#b91c1c', fontSize: 14, marginBottom: 12 }} role="alert">
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" disabled={pending} onClick={onClose} style={btnMuted}>
            {t('close')}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void confirm()}
            style={{
              ...btnSolid,
              background: pending ? '#9ca3af' : '#b91c1c',
              cursor: pending ? 'not-allowed' : 'pointer',
            }}
          >
            {pending ? t('employees_delete_saving') : t('employees_delete_confirm')}
          </button>
        </div>
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

function normalizeStatus(s: string): 'active' | 'inactive' {
  return s.toLowerCase() === 'inactive' ? 'inactive' : 'active';
}

const iconBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  padding: 0,
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  background: '#fff',
  cursor: 'pointer',
};

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

  const [showAdd, setShowAdd] = useState(false);
  const [addModalToken, setAddModalToken] = useState(0);
  const [rowEditMode, setRowEditMode] = useState(false);
  const [editUser, setEditUser] = useState<EmployeeTableRow | null>(null);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [deleteUser, setDeleteUser] = useState<EmployeeTableRow | null>(null);

  useEffect(() => {
    if (!banner || banner.type !== 'ok') return;
    const id = window.setTimeout(() => setBanner(null), 6000);
    return () => window.clearTimeout(id);
  }, [banner]);

  const onAddSuccess = useCallback(() => {
    setBanner({ type: 'ok', text: t('employees_success_added') });
  }, [t]);

  return (
    <>
      {banner && (
        <div
          role="status"
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 8,
            fontWeight: 600,
            background: banner.type === 'ok' ? '#dcfce7' : '#fee2e2',
            color: banner.type === 'ok' ? '#166534' : '#991b1b',
          }}
        >
          {banner.text}
        </div>
      )}

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

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 16,
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => {
            setAddModalToken((n) => n + 1);
            setShowAdd(true);
          }}
          style={btnSolid}
        >
          {t('employees_add_employee')}
        </button>
        {!rowEditMode ? (
          <button type="button" onClick={() => setRowEditMode(true)} style={btnPrimaryOutline}>
            {t('employees_edit_employees')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setRowEditMode(false)}
            style={btnMuted}
          >
            {t('employees_done_editing')}
          </button>
        )}
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
              {rowEditMode && (
                <th
                  scope="col"
                  aria-label={t('employees_col_row_actions')}
                  style={{ padding: '10px 8px', width: 96 }}
                />
              )}
              <th style={{ padding: '10px 8px' }}>{t('employees_col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 8px', minWidth: 120 }}>
                  {u.fullName}
                  {!u.firestoreBacked && (
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{t('employees_legacy_row_hint')}</div>
                  )}
                </td>
                <td style={{ padding: '10px 8px' }}>{u.username}</td>
                <td style={{ padding: '10px 8px' }}>{translateRole(u.role, t)}</td>
                <td style={{ padding: '10px 8px' }}>{translateUserStatus(u.status, t)}</td>
                <td style={{ padding: '10px 8px' }}>
                  {u.mustChangePassword === true
                    ? t('password_status_must_change')
                    : t('password_status_active')}
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
                {rowEditMode && (
                  <td style={{ padding: '10px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        disabled={!u.firestoreBacked}
                        title={!u.firestoreBacked ? t('employees_legacy_row_hint') : undefined}
                        aria-label={t('employees_aria_edit_employee')}
                        onClick={() => u.firestoreBacked && setEditUser(u)}
                        style={{
                          ...iconBtn,
                          color: '#166534',
                          opacity: u.firestoreBacked ? 1 : 0.35,
                          cursor: u.firestoreBacked ? 'pointer' : 'not-allowed',
                        }}
                      >
                        <PencilIcon />
                      </button>
                      {u.firestoreBacked ? (
                        <button
                          type="button"
                          aria-label={t('employees_aria_remove_employee')}
                          onClick={() => setDeleteUser(u)}
                          style={{
                            ...iconBtn,
                            color: '#b91c1c',
                            borderColor: '#fecaca',
                          }}
                        >
                          <XIcon />
                        </button>
                      ) : (
                        <span style={{ display: 'inline-flex', width: 36 }} aria-hidden />
                      )}
                    </div>
                  </td>
                )}
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
      {showAdd && (
        <AddEmployeeModal key={addModalToken} onClose={() => setShowAdd(false)} onSuccessMessage={onAddSuccess} />
      )}
      {editUser && (
        <EditEmployeeModal
          key={editUser.id}
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => setBanner({ type: 'ok', text: t('employees_success_saved') })}
        />
      )}
      {deleteUser && (
        <ConfirmDeleteModal
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onDone={() => setBanner({ type: 'ok', text: t('employees_success_removed') })}
        />
      )}
    </>
  );
}
