'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Button from '@/components/Button';
import { useLanguage } from '@/components/LanguageToggle';
import type { TranslationKey } from '@/lib/i18n/translations';
import {
  EMPTY_ADVANCED_FILTERS,
  type AdvancedCheckinsFilters,
} from '@/lib/checkins/advancedFilters';
import { validateViewCheckinsDateRange } from '@/lib/checkins/dateRangeFilter';
import {
  PAYMENT_METHODS,
  getPaymentMethodTranslationKey,
} from '@/lib/checkins/paymentMethods';

const SHIFT_KEYS: TranslationKey[] = ['section_bucket_1', 'section_bucket_2', 'section_bucket_3'];
const TYPE_KEYS: Record<'room' | 'food' | 'beer', TranslationKey> = {
  room: 'table_type_room',
  food: 'table_type_food',
  beer: 'table_type_beer',
};

type FilterOptions = {
  rooms: string[];
  staff: string[];
};

export default function AdvancedFiltersModal({
  open,
  onOpenChange,
  todayISO,
  startDate,
  endDate,
  appliedFilters,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todayISO: string;
  startDate: string;
  endDate: string;
  appliedFilters: AdvancedCheckinsFilters;
  onApply: (next: {
    startDate: string;
    endDate: string;
    filters: AdvancedCheckinsFilters;
  }) => void;
}) {
  const { t } = useLanguage();
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const [draft, setDraft] = useState<AdvancedCheckinsFilters>(appliedFilters);
  const [dateError, setDateError] = useState<string | null>(null);
  const [options, setOptions] = useState<FilterOptions>({ rooms: [], staff: [] });

  useEffect(() => {
    if (!open) return;
    setDraftStart(startDate);
    setDraftEnd(endDate);
    setDraft(appliedFilters);
    setDateError(null);
  }, [open, startDate, endDate, appliedFilters]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/admin/checkins/filter-options', { credentials: 'include' });
        if (!res.ok) return;
        const data = (await res.json()) as { rooms?: string[]; staff?: string[] };
        if (!cancelled) {
          const rooms = Array.isArray(data.rooms) ? data.rooms : [];
          const staff = Array.isArray(data.staff) ? data.staff : [];
          if (appliedFilters.staff && !staff.includes(appliedFilters.staff)) {
            staff.push(appliedFilters.staff);
            staff.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
          }
          setOptions({ rooms, staff });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, appliedFilters.staff]);

  if (!open) return null;

  const fieldStyle: CSSProperties = { display: 'grid', gap: 6 };
  const inputStyle: CSSProperties = {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    width: '100%',
    boxSizing: 'border-box',
    fontSize: 16,
  };

  const handleApply = () => {
    const validation = validateViewCheckinsDateRange(draftStart, draftEnd, todayISO);
    if (!validation.ok) {
      setDateError(
        validation.code === 'end_before_start'
          ? t('list_date_range_end_before_start')
          : validation.code === 'range_exceeds_max'
            ? t('list_date_range_exceeds_max')
            : validation.code === 'future_date'
              ? t('list_date_range_future')
              : t('list_date_range_invalid')
      );
      return;
    }
    onApply({
      startDate: validation.startISO,
      endDate: validation.endISO,
      filters: {
        ...draft,
        receipt: draft.receipt.trim(),
        staff: draft.staff.trim(),
        room: draft.room.trim(),
      },
    });
    onOpenChange(false);
  };

  return (
    <div
      className="advanced-filters-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="advanced-filters-title"
      onClick={() => onOpenChange(false)}
    >
      <div className="card advanced-filters-modal" onClick={(e) => e.stopPropagation()}>
        <h2 id="advanced-filters-title" style={{ margin: 0, fontSize: 18 }}>
          {t('list_advanced_filters')}
        </h2>

        <div style={{ display: 'grid', gap: 14 }}>
          <label style={fieldStyle}>
            <span>{t('list_start_date')}</span>
            <input
              type="date"
              value={draftStart}
              max={todayISO}
              onChange={(e) => {
                setDraftStart(e.target.value);
                setDateError(null);
              }}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span>{t('list_end_date')}</span>
            <input
              type="date"
              value={draftEnd}
              max={todayISO}
              onChange={(e) => {
                setDraftEnd(e.target.value);
                setDateError(null);
              }}
              style={inputStyle}
            />
          </label>
          {dateError && (
            <div role="alert" style={{ fontSize: 14, color: '#991b1b' }}>
              {dateError}
            </div>
          )}

          <label style={fieldStyle}>
            <span>{t('table_receipt')}</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder={t('list_filter_receipt_placeholder')}
              value={draft.receipt}
              onChange={(e) => setDraft((d) => ({ ...d, receipt: e.target.value }))}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span>{t('list_filter_shift')}</span>
            <select
              value={draft.shift}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  shift: e.target.value as AdvancedCheckinsFilters['shift'],
                }))
              }
              style={inputStyle}
            >
              <option value="">{t('list_filter_any_shift')}</option>
              {SHIFT_KEYS.map((key, idx) => (
                <option key={key} value={String(idx)}>
                  {t(key)}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span>{t('table_type')}</span>
            <select
              value={draft.type}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  type: e.target.value as AdvancedCheckinsFilters['type'],
                }))
              }
              style={inputStyle}
            >
              <option value="">{t('list_filter_any_type')}</option>
              {(['room', 'food', 'beer'] as const).map((ty) => (
                <option key={ty} value={ty}>
                  {t(TYPE_KEYS[ty])}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span>{t('table_room')}</span>
            <select
              value={draft.room}
              onChange={(e) => setDraft((d) => ({ ...d, room: e.target.value }))}
              style={inputStyle}
            >
              <option value="">{t('list_filter_any_room')}</option>
              {options.rooms.map((r) => (
                <option key={r} value={r}>
                  {t('room')} {r}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span>{t('table_staff')}</span>
            <select
              value={draft.staff}
              onChange={(e) => setDraft((d) => ({ ...d, staff: e.target.value }))}
              style={inputStyle}
            >
              <option value="">{t('list_filter_any_staff')}</option>
              {options.staff.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span>{t('payment_method')}</span>
            <select
              value={draft.payment}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  payment: e.target.value as AdvancedCheckinsFilters['payment'],
                }))
              }
              style={inputStyle}
            >
              <option value="">{t('list_filter_any_payment')}</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {t(getPaymentMethodTranslationKey(m) as TranslationKey)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="advanced-filters-modal-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDraft(EMPTY_ADVANCED_FILTERS);
              setDateError(null);
            }}
          >
            {t('list_clear_advanced')}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button type="button" variant="primary" onClick={handleApply}>
            {t('list_apply_filters')}
          </Button>
        </div>
      </div>
    </div>
  );
}
