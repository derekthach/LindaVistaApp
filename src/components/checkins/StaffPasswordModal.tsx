'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

const DIGIT_COUNT = 4;

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.5)',
  backdropFilter: 'blur(4px)',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'rgb(45 45 55)',
  borderRadius: 24,
  padding: '28px 32px',
  minWidth: 360,
  maxWidth: 400,
  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
};

const titleStyle: React.CSSProperties = {
  color: '#fff',
  fontSize: 20,
  fontWeight: 700,
  textAlign: 'center',
  margin: '0 0 12px',
};

const descriptionStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.9)',
  fontSize: 14,
  textAlign: 'center',
  margin: '0 0 24px',
  lineHeight: 1.45,
};

const digitsContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  justifyContent: 'center',
  marginBottom: 24,
};

const digitInputStyle: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 12,
  border: 'none',
  backgroundColor: 'rgba(255,255,255,0.95)',
  color: '#1a1a1a',
  fontSize: 22,
  fontWeight: 600,
  textAlign: 'center',
  outline: 'none',
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 20px',
  borderRadius: 12,
  border: 'none',
  backgroundColor: '#f97316',
  color: '#fff',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
};

const errorStyle: React.CSSProperties = {
  color: '#f87171',
  fontSize: 13,
  textAlign: 'center',
  marginTop: -16,
  marginBottom: 16,
};

export interface StaffPasswordModalProps {
  open: boolean;
  staffName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StaffPasswordModal({
  open,
  staffName,
  onClose,
  onSuccess,
}: StaffPasswordModalProps) {
  const [digits, setDigits] = useState<string[]>(Array(DIGIT_COUNT).fill(''));
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const focus = useCallback((index: number) => {
    inputRefs.current[index]?.focus();
  }, []);

  useEffect(() => {
    if (open) {
      setDigits(Array(DIGIT_COUNT).fill(''));
      setError('');
      setVerifying(false);
      setTimeout(() => focus(0), 0);
    }
  }, [open, focus]);

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      focus(index - 1);
    }
  };

  const handleChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setError('');
    if (char && index < DIGIT_COUNT - 1) focus(index + 1);
  };

  const handleVerify = async () => {
    const password = digits.join('');
    if (password.length !== DIGIT_COUNT) {
      setError('Please enter the 4-digit password');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      const res = await fetch('/api/verify-staff-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffName, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        onSuccess();
        onClose();
        return;
      }
      setError(data.error || 'Incorrect password');
    } catch {
      setError('Something went wrong');
    } finally {
      setVerifying(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-password-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <h2 id="staff-password-title" style={titleStyle}>
          Enter password
        </h2>
        <p style={descriptionStyle}>
          Please enter the password for {staffName}
        </p>
        <div style={digitsContainerStyle}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              autoComplete="one-time-code"
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              style={digitInputStyle}
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>
        {error && <div style={errorStyle}>{error}</div>}
        <button
          type="button"
          onClick={handleVerify}
          disabled={verifying}
          style={buttonStyle}
        >
          {verifying ? 'Verifying…' : 'Verify'}
        </button>
      </div>
    </div>
  );
}
