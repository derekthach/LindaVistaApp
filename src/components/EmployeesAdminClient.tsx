'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { adminResetEmployeePasswordAction } from '@/app/actions/employeesAdmin';
import { LV_PENDING_RESETS_INVALIDATE } from '@/lib/adminNavEvents';

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
      {pending ? 'Saving…' : 'Set password'}
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
  const [state, formAction] = useActionState(adminResetEmployeePasswordAction, undefined as
    | { error?: string; ok?: boolean }
    | undefined);

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
        <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Reset password</h2>
        <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: 14 }}>
          Temporary password for <strong>{user.fullName}</strong> ({user.username}). They will be required to
          change it on next login.
        </p>
        <form action={formAction} style={{ display: 'grid', gap: 12 }}>
          <input type="hidden" name="userId" value={user.id} />
          <label>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>New temporary password</div>
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
          {state?.ok && <div style={{ color: '#166534', fontSize: 14 }}>Password updated.</div>}
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
              Close
            </button>
            {!state?.ok && <ResetSubmit />}
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EmployeesAdminClient({
  users,
  pendingResetCount,
}: {
  users: EmployeeTableRow[];
  pendingResetCount: number;
}) {
  const [resetUser, setResetUser] = useState<EmployeeTableRow | null>(null);

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
        Reset requests pending: {pendingResetCount}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
              <th style={{ padding: '10px 8px' }}>Full name</th>
              <th style={{ padding: '10px 8px' }}>Username</th>
              <th style={{ padding: '10px 8px' }}>Role</th>
              <th style={{ padding: '10px 8px' }}>Status</th>
              <th style={{ padding: '10px 8px' }}>Password status</th>
              <th style={{ padding: '10px 8px' }}>Reset</th>
              <th style={{ padding: '10px 8px' }}>Last login</th>
              <th style={{ padding: '10px 8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 8px' }}>{u.fullName}</td>
                <td style={{ padding: '10px 8px' }}>{u.username}</td>
                <td style={{ padding: '10px 8px' }}>{u.role}</td>
                <td style={{ padding: '10px 8px' }}>{u.status}</td>
                <td style={{ padding: '10px 8px' }}>
                  {u.mustChangePassword ? 'Must change password' : 'Active'}
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
                      Reset requested
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}
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
                    Reset password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetUser && (
        <ResetPasswordModal key={resetUser.id} user={resetUser} onClose={() => setResetUser(null)} />
      )}
    </>
  );
}
