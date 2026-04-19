'use client';

import { useEffect, useRef, useState } from 'react';

export type QuantitySoldInputProps = {
  /** Committed quantity; use `0` for “empty” while the user is editing toward a new value. */
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  /**
   * On focus, if the value equals `min` (typical default “1”), clear the field for fast typing.
   * Otherwise all text is selected so the user can replace it without using spinners.
   */
  clearDefaultOnFocus?: boolean;
  style?: React.CSSProperties;
  disabled?: boolean;
  'aria-label'?: string;
};

/**
 * Text-based quantity entry (no number spinners). Supports empty state while typing;
 * normalizes to [min, max] on blur. Used for “Cantidad Vendida” on food/beer flows.
 */
export function QuantitySoldInput({
  value,
  onChange,
  min = 1,
  max = 50,
  clearDefaultOnFocus = true,
  style,
  disabled,
  'aria-label': ariaLabel,
}: QuantitySoldInputProps) {
  const [text, setText] = useState(() => {
    if (value <= 0) return '';
    const clamped = Math.min(max, Math.max(min, value));
    return String(clamped);
  });
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    if (value <= 0) {
      setText('');
      return;
    }
    if (value >= min && value <= max) {
      setText(String(value));
    }
  }, [value, min, max]);

  const maxLen = String(max).length;

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      aria-label={ariaLabel}
      disabled={disabled}
      value={text}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, maxLen);
        setText(digits);
        if (digits === '') {
          onChange(0);
          return;
        }
        const n = parseInt(digits, 10);
        if (!Number.isFinite(n)) {
          onChange(0);
          return;
        }
        onChange(Math.min(max, Math.max(0, n)));
      }}
      onFocus={(e) => {
        focusedRef.current = true;
        if (clearDefaultOnFocus && value === min) {
          setText('');
          onChange(0);
          return;
        }
        e.currentTarget.select();
      }}
      onBlur={() => {
        focusedRef.current = false;
        const digits = text.replace(/\D/g, '');
        let n = parseInt(digits, 10);
        if (digits === '' || !Number.isFinite(n) || n < min) n = min;
        if (n > max) n = max;
        onChange(n);
        setText(String(n));
      }}
      style={style}
    />
  );
}
