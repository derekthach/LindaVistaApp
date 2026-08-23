'use client';

import { useMemo, useState } from 'react';
import type { CheckIn } from '@/types';
import Button from '@/components/Button';
import { useLanguage } from '@/components/LanguageToggle';
import {
  calculateDayShiftSummaries,
  shiftDisplayLabel,
  type RoomTurnoverRecord,
  type ShiftSummary,
} from '@/lib/shifts';

export type SerializedRoomTurnover = {
  id: string;
  checkedOutAt: string;
  cleanedAt: string;
};

function deserializeTurnovers(rows: SerializedRoomTurnover[]): RoomTurnoverRecord[] {
  return rows
    .map((r) => ({
      id: r.id,
      checkedOutAt: new Date(r.checkedOutAt),
      cleanedAt: new Date(r.cleanedAt),
    }))
    .filter(
      (r) =>
        r.id &&
        !Number.isNaN(r.checkedOutAt.getTime()) &&
        !Number.isNaN(r.cleanedAt.getTime())
    );
}

function formatRevenue(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Shift Summaries for the selected View Check-Ins day.
 * Revenue/cars: derived from already-loaded day check-ins (no extra fetch).
 * Turnovers: from SSR-bounded cleanedAt window passed as props.
 */
export default function ShiftSummariesPanel({
  businessDate,
  checkins,
  turnovers,
  isAdmin,
}: {
  businessDate: string;
  checkins: CheckIn[];
  turnovers: SerializedRoomTurnover[];
  isAdmin: boolean;
}) {
  const { t } = useLanguage();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const summaries: ShiftSummary[] = useMemo(() => {
    return calculateDayShiftSummaries(businessDate, checkins, deserializeTurnovers(turnovers));
  }, [businessDate, checkins, turnovers]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerateMessage(null);
    setGenerateError(null);
    try {
      const res = await fetch('/api/admin/shift-summaries/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessDate }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setGenerateError(data.error ?? t('shift_summaries_generate_error'));
        return;
      }
      setGenerateMessage(t('shift_summaries_generate_success'));
    } catch {
      setGenerateError(t('shift_summaries_generate_error'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="card" style={{ display: 'grid', gap: 12, padding: 16 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <strong style={{ fontSize: 15 }}>{t('shift_summaries_heading')}</strong>
        {isAdmin && (
          <Button variant="secondary" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? t('shift_summaries_generating') : t('shift_summaries_generate')}
          </Button>
        )}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {summaries.map((summary) => (
          <div
            key={summary.shift}
            style={{
              padding: '10px 12px',
              backgroundColor: '#f9fafb',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6, color: '#111827' }}>
              {shiftDisplayLabel(summary.shift)}
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px 16px',
                fontSize: 13,
                color: '#374151',
                lineHeight: 1.6,
              }}
            >
              <span>
                {t('shift_summaries_revenue')}: {formatRevenue(summary.totalRevenue)}
              </span>
              <span>
                {t('shift_summaries_cars')}: {summary.totalCars}
              </span>
              <span>
                {t('shift_summaries_rooms_turned_over')}: {summary.roomsTurnedOver}
              </span>
            </div>
          </div>
        ))}
      </div>

      {generateMessage && (
        <p style={{ margin: 0, fontSize: 13, color: '#166534' }}>{generateMessage}</p>
      )}
      {generateError && (
        <p style={{ margin: 0, fontSize: 13, color: '#991b1b' }}>{generateError}</p>
      )}
    </div>
  );
}
