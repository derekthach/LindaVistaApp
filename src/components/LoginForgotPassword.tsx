'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n/useTranslation';

export default function LoginForgotPassword() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });
      await res.json().catch(() => ({}));
      setMessage(t('forgot_password_generic'));
      setUsername('');
    } catch {
      setError(t('forgot_submit_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 20, fontSize: 14 }}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setMessage(null);
          setError(null);
        }}
        style={{
          background: 'none',
          border: 'none',
          color: '#166534',
          cursor: 'pointer',
          textDecoration: 'underline',
          padding: 0,
          font: 'inherit',
        }}
      >
        {t('forgot_password')}
      </button>

      {open && (
        <form
          onSubmit={(e) => void submit(e)}
          style={{ marginTop: 12, display: 'grid', gap: 10, textAlign: 'left' }}
        >
          <label>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('username')}</div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: loading ? '#9ca3af' : '#166534',
              color: '#fff',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? t('forgot_sending') : t('forgot_submit')}
          </button>
          {message && <p style={{ margin: 0, color: '#166534' }}>{message}</p>}
          {error && <p style={{ margin: 0, color: '#b91c1c' }}>{error}</p>}
        </form>
      )}
    </div>
  );
}
