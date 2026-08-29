'use client';

import { useMemo, useState } from 'react';
import type { CheckIn } from '@/types';
import Button from '@/components/Button';
import { useLanguage } from '@/components/LanguageToggle';
import {
  calculateDailySummary,
  calculateDayShiftSummaries,
  formatIncompleteDailySummary,
  getShiftDisplayLabel,
  isCompleteDailySummary,
  type RoomTurnoverRecord,
  type ShiftSummary,
} from '@/lib/shifts';
import { buildSectionedData } from '@/lib/checkins/sectioning';

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
 * Daily + Shift Summaries for the selected View Check-Ins day.
 * Daily metrics aggregate in-memory Shift Summaries — 0 additional Firestore reads for display.
 * Persist actions are explicit Admin generate only.
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
  const [isGeneratingShifts, setIsGeneratingShifts] = useState(false);
  const [isGeneratingDaily, setIsGeneratingDaily] = useState(false);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const summaries: ShiftSummary[] = useMemo(() => {
    return calculateDayShiftSummaries(businessDate, checkins, deserializeTurnovers(turnovers));
  }, [businessDate, checkins, turnovers]);

  const dailyResult = useMemo(() => {
    const sectioned = buildSectionedData(checkins);
    return calculateDailySummary(summaries, {
      checkinCount: checkins.length,
      viewCheckinsSections: [
        sectioned.sectionTotals[0]!,
        sectioned.sectionTotals[1]!,
        sectioned.sectionTotals[2]!,
      ],
      viewCheckinsDayTotals: sectioned.dayTotals,
    });
  }, [summaries, checkins]);

  const handleGenerateShifts = async () => {
    setIsGeneratingShifts(true);
    setGenerateMessage(null);
    setGenerateError(null);
    try {
      const res = await fetch('/api/admin/shift-summaries/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessDate }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        ok?: boolean;
      };
      if (!res.ok) {
        setGenerateError(data.message ?? data.error ?? t('shift_summaries_generate_error'));
        return;
      }
      setGenerateMessage(t('shift_summaries_generate_success'));
    } catch {
      setGenerateError(t('shift_summaries_generate_error'));
    } finally {
      setIsGeneratingShifts(false);
    }
  };

  const handleGenerateDaily = async () => {
    setIsGeneratingDaily(true);
    setGenerateMessage(null);
    setGenerateError(null);
    try {
      const res = await fetch('/api/admin/daily-summaries/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessDate }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        code?: string;
        ok?: boolean;
      };
      if (!res.ok) {
        setGenerateError(data.message ?? data.error ?? t('daily_summary_generate_error'));
        return;
      }
      setGenerateMessage(t('daily_summary_generate_success'));
    } catch {
      setGenerateError(t('daily_summary_generate_error'));
    } finally {
      setIsGeneratingDaily(false);
    }
  };

  const busy = isGeneratingShifts || isGeneratingDaily;

  return (
    <div className="card" style={{ display: 'grid', gap: 16, padding: 16 }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <strong style={{ fontSize: 15 }}>{t('daily_summary_heading')}</strong>
        {isCompleteDailySummary(dailyResult) ? (
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#f3f4f6',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 8 }}>
              {t('daily_summary_complete')}
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px 20px',
                fontSize: 14,
                color: '#111827',
                lineHeight: 1.6,
              }}
            >
              <span>
                <strong>{t('shift_summaries_revenue')}</strong>
                <br />
                {formatRevenue(dailyResult.totalRevenue)}
              </span>
              <span>
                <strong>{t('shift_summaries_cars')}</strong>
                <br />
                {dailyResult.totalCars}
              </span>
              <span>
                <strong>{t('shift_summaries_rooms_turned_over')}</strong>
                <br />
                {dailyResult.roomsTurnedOver}
              </span>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#fffbeb',
              borderRadius: 8,
              border: '1px solid #fcd34d',
              fontSize: 13,
              color: '#92400e',
            }}
          >
            {t('daily_summary_incomplete')}: {formatIncompleteDailySummary(dailyResult)}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <strong style={{ fontSize: 15 }}>{t('shift_breakdown_heading')}</strong>
          {isAdmin && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Button variant="secondary" onClick={handleGenerateShifts} disabled={busy}>
                {isGeneratingShifts ? t('shift_summaries_generating') : t('shift_summaries_generate')}
              </Button>
              <Button variant="secondary" onClick={handleGenerateDaily} disabled={busy}>
                {isGeneratingDaily ? t('daily_summary_generating') : t('daily_summary_generate')}
              </Button>
            </div>
          )}
        </div>

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
              {getShiftDisplayLabel(summary.shift)}
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
