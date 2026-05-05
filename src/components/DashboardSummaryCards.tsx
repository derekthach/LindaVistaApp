'use client';

import type { CSSProperties } from 'react';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { SummaryMetrics } from '@/types';
import type { TranslationKey } from '@/lib/i18n/translations';

/** Bottom-align value block: stretch to row height, push block down */
const cardShell: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
};

const valueFooter: CSSProperties = {
  marginTop: 'auto',
  paddingTop: 8,
};

const valueStrong: CSSProperties = {
  fontSize: 24,
  display: 'block',
};

function MetricDeltaRow({
  delta,
  variant,
  noChangeAriaKey,
}: {
  delta: number;
  variant: 'count' | 'currency';
  noChangeAriaKey: TranslationKey;
}) {
  const { t } = useTranslation();
  if (variant === 'count' && delta === 0) {
    return (
      <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }} aria-label={t(noChangeAriaKey)}>
        —
      </div>
    );
  }
  if (variant === 'currency' && Math.abs(delta) < 0.005) {
    return (
      <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }} aria-label={t(noChangeAriaKey)}>
        —
      </div>
    );
  }
  const up = delta > 0;
  const color = up ? '#16a34a' : '#dc2626';
  const arrow = up ? '▲' : '▼';
  const text =
    variant === 'currency' ? `$${Math.abs(delta).toFixed(2)}` : String(Math.abs(delta));

  return (
    <div style={{ fontSize: 14, fontWeight: 600, color, marginTop: 6 }}>
      <span aria-hidden>{arrow}</span> <span>{text}</span>
    </div>
  );
}

export default function DashboardSummaryCards({ metrics }: { metrics: SummaryMetrics }) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
        alignItems: 'stretch',
      }}
    >
      <div className="card" style={cardShell}>
        <div>{t('metric_today_checkins')}</div>
        <div style={valueFooter}>
          <strong style={valueStrong}>{metrics.carsToday}</strong>
          <MetricDeltaRow
            delta={metrics.todayCarsDeltaVsYesterday}
            variant="count"
            noChangeAriaKey="metric_today_delta_no_change"
          />
        </div>
      </div>
      <div className="card" style={cardShell}>
        <div>
          <div>{t('metric_week_checkins')}</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
            {t('metric_motel_week_subcaption')}
          </div>
        </div>
        <div style={valueFooter}>
          <strong style={valueStrong}>{metrics.carsThisWeek}</strong>
          <MetricDeltaRow
            delta={metrics.weekCarsDeltaVsPrior}
            variant="count"
            noChangeAriaKey="metric_week_delta_no_change"
          />
        </div>
      </div>
      <div className="card" style={cardShell}>
        <div>{t('metric_today_revenue')}</div>
        <div style={valueFooter}>
          <strong style={valueStrong}>${metrics.profitToday.toFixed(2)}</strong>
          <MetricDeltaRow
            delta={metrics.todayRevenueDeltaVsYesterday}
            variant="currency"
            noChangeAriaKey="metric_today_delta_no_change"
          />
        </div>
      </div>
      <div className="card" style={cardShell}>
        <div>
          <div>{t('metric_week_revenue')}</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
            {t('metric_motel_week_subcaption')}
          </div>
        </div>
        <div style={valueFooter}>
          <strong style={valueStrong}>${metrics.profitThisWeek.toFixed(2)}</strong>
          <MetricDeltaRow
            delta={metrics.weekRevenueDeltaVsPrior}
            variant="currency"
            noChangeAriaKey="metric_week_delta_no_change"
          />
        </div>
      </div>
    </div>
  );
}
