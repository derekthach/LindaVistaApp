'use client';

import { useState } from 'react';

export default function LoginForgotPassword() {
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
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setMessage(typeof data.message === 'string' ? data.message : 'Request submitted.');
      setUsername('');
    } catch {
      setError('Could not submit request. Try again later.');
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
        Forgot password?
      </button>

      {open && (
        <form
          onSubmit={(e) => void submit(e)}
          style={{ marginTop: 12, display: 'grid', gap: 10, textAlign: 'left' }}
        >
          <label>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Username</div>
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
            {loading ? 'Sending…' : 'Submit request'}
          </button>
          {message && <p style={{ margin: 0, color: '#166534' }}>{message}</p>}
          {error && <p style={{ margin: 0, color: '#b91c1c' }}>{error}</p>}
        </form>
      )}
    </div>
  );
}
