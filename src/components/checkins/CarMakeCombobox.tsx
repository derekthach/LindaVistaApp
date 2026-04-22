'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/components/LanguageToggle';
import type { TranslationKey } from '@/lib/i18n/translations';
import { filterCarMakes, shouldOfferAddNewCarMake } from '@/lib/checkins/filterCarMakes';

export type PersistNewCarMakeResult =
  | { ok: true; nameUpper: string }
  | { ok: false; error: string };

export interface CarMakeComboboxProps {
  name?: string;
  options: readonly string[];
  value: string;
  onChange: (make: string) => void;
  onBlur?: () => void;
  /** Match CheckinForm input styling */
  inputStyle?: React.CSSProperties;
  /**
   * POST new make (Firestore via /api/car-makes) and refresh parent options.
   * Required for in-dropdown "add when no match" flow.
   */
  persistNewCarMake?: (trimmedName: string) => Promise<PersistNewCarMakeResult>;
}

const LIST_MAX_HEIGHT = 280;
const MODAL_Z = 100;

/**
 * Searchable combobox: trigger shows selection; popover has filter input + scrollable list.
 * When there are zero matches and input is non-empty (and not a case-insensitive duplicate), offers add with confirm modal.
 */
export default function CarMakeCombobox({
  name = 'car_make',
  options,
  value,
  onChange,
  onBlur,
  inputStyle,
  persistNewCarMake,
}: CarMakeComboboxProps) {
  const { t } = useLanguage();
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const triggerId = `${baseId}-trigger`;

  const [open, setOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTrimmed, setPendingTrimmed] = useState('');
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const defaultInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    fontSize: 14,
  };
  const mergedInputStyle = { ...defaultInputStyle, ...inputStyle };

  const filtered = useMemo(() => filterCarMakes(options, filterText), [options, filterText]);

  const addOffer = useMemo(() => {
    if (!persistNewCarMake) return { offer: false } as const;
    return shouldOfferAddNewCarMake(options, filterText);
  }, [options, filterText, persistNewCarMake]);

  const close = useCallback(() => {
    if (confirmOpen) return;
    setOpen(false);
    setFilterText('');
    setHighlightedIndex(0);
    onBlur?.();
  }, [onBlur, confirmOpen]);

  const openPopover = useCallback(() => {
    setFilterText('');
    setHighlightedIndex(0);
    setOpen(true);
  }, []);

  const closeConfirmOnly = useCallback(() => {
    setConfirmOpen(false);
    setPendingTrimmed('');
    setConfirmError(null);
    setConfirmSubmitting(false);
    requestAnimationFrame(() => filterInputRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open || confirmOpen) return;
    const timer = window.setTimeout(() => filterInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open, confirmOpen]);

  useEffect(() => {
    setHighlightedIndex((i) => {
      if (filtered.length === 0) return 0;
      return Math.min(i, filtered.length - 1);
    });
  }, [filtered.length]);

  useEffect(() => {
    if (!open || confirmOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = containerRef.current;
      if (el && !el.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open, confirmOpen, close]);

  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmSubmitting) {
        e.preventDefault();
        closeConfirmOnly();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmOpen, confirmSubmitting, closeConfirmOnly]);

  const selectMake = useCallback(
    (make: string) => {
      onChange(make);
      setOpen(false);
      setFilterText('');
      setHighlightedIndex(0);
      onBlur?.();
      requestAnimationFrame(() => triggerRef.current?.focus());
    },
    [onChange, onBlur]
  );

  const openAddConfirm = useCallback(() => {
    if (addOffer.offer !== true) return;
    setPendingTrimmed(addOffer.trimmed);
    setConfirmError(null);
    setConfirmOpen(true);
  }, [addOffer]);

  const handleConfirmAdd = useCallback(async () => {
    if (!persistNewCarMake || confirmSubmitting || !pendingTrimmed) return;
    setConfirmSubmitting(true);
    setConfirmError(null);
    const result = await persistNewCarMake(pendingTrimmed);
    setConfirmSubmitting(false);
    if (!result.ok) {
      setConfirmError(result.error);
      return;
    }
    onChange(result.nameUpper);
    setConfirmOpen(false);
    setPendingTrimmed('');
    setOpen(false);
    setFilterText('');
    setHighlightedIndex(0);
    onBlur?.();
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [persistNewCarMake, confirmSubmitting, pendingTrimmed, onChange, onBlur]);

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      openPopover();
    }
  };

  const onFilterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (confirmOpen && !confirmSubmitting) {
        closeConfirmOnly();
      } else if (!confirmOpen) {
        close();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filtered.length === 0) return;
      setHighlightedIndex((i) => (i + 1) % filtered.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtered.length === 0) return;
      setHighlightedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0) {
        const pick = filtered[highlightedIndex] ?? filtered[0];
        if (pick) selectMake(pick);
      }
      return;
    }
  };

  const displayLabel = value.trim() ? value : t('car_make_select_placeholder');

  const addActionLabel =
    addOffer.offer === true
      ? t('car_make_add_new_action').replace(/\{make\}/g, addOffer.trimmed)
      : '';

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input type="hidden" name={name} value={value} readOnly aria-hidden />

      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        className="car-make-combobox-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => (open ? close() : openPopover())}
        onKeyDown={onTriggerKeyDown}
        style={{
          ...mergedInputStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          cursor: 'pointer',
          textAlign: 'left',
          background: '#fff',
          color: value.trim() ? '#111' : '#9ca3af',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayLabel}</span>
        <span style={{ flexShrink: 0, color: '#6b7280', fontSize: 12 }} aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={triggerId}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '100%',
            marginTop: 4,
            zIndex: 50,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}
        >
          <input
            ref={filterInputRef}
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            onKeyDown={onFilterKeyDown}
            placeholder={t('car_make_search_placeholder')}
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls={listboxId}
            style={{
              ...mergedInputStyle,
              borderRadius: 0,
              border: 'none',
              borderBottom: '1px solid #e5e7eb',
            }}
          />
          <div
            role="presentation"
            style={{
              maxHeight: LIST_MAX_HEIGHT,
              overflowY: 'auto',
            }}
          >
            {filtered.length === 0 ? (
              <div style={{ padding: '12px 10px' }}>
                <div style={{ color: '#6b7280', fontSize: 14, marginBottom: addOffer.offer === true ? 10 : 0 }}>
                  {t('car_make_no_results')}
                </div>
                {addOffer.offer === true && (
                  <button
                    type="button"
                    onClick={openAddConfirm}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid #166534',
                      background: '#f0fdf4',
                      color: '#166534',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {addActionLabel}
                  </button>
                )}
              </div>
            ) : (
              filtered.map((make, idx) => {
                const active = idx === highlightedIndex;
                return (
                  <button
                    key={make}
                    type="button"
                    role="option"
                    aria-selected={make === value}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => selectMake(make)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 12px',
                      border: 'none',
                      borderBottom: '1px solid #f3f4f6',
                      background: active ? '#ecfdf5' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: 14,
                    }}
                  >
                    {make}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${baseId}-add-title`}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: MODAL_Z,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.4)',
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !confirmSubmitting) closeConfirmOnly();
          }}
        >
          <div
            className="card"
            style={{ maxWidth: 400, width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={`${baseId}-add-title`} style={{ margin: '0 0 12px', fontSize: 18 }}>
              {t('car_make_add_modal_title')}
            </h2>
            <p style={{ margin: '0 0 16px', color: '#374151', fontSize: 14 }}>{t('car_make_add_modal_body')}</p>
            {t('car_make_add_modal_detail').trim() ? (
              <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: 13 }}>
                {t('car_make_add_modal_detail').replace(/\{make\}/g, pendingTrimmed)}
              </p>
            ) : null}
            {confirmError && (
              <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>
                {t(confirmError as TranslationKey)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={confirmSubmitting}
                onClick={closeConfirmOnly}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  cursor: confirmSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={confirmSubmitting}
                onClick={() => void handleConfirmAdd()}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: confirmSubmitting ? '#9ca3af' : '#166534',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: confirmSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {confirmSubmitting ? '…' : t('car_make_confirm_yes_add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
