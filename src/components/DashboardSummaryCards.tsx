'use client';

import { useTranslation } from '@/lib/i18n/useTranslation';
import type { SummaryMetrics } from '@/types';

export default function DashboardSummaryCards({ metrics }: { metrics: SummaryMetrics }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
      <div className="card">
        <div>{t('metric_today_checkins')}</div>
        <strong style={{ fontSize: 24 }}>{metrics.carsToday}</strong>
      </div>
      <div className="card">
        <div>{t('metric_week_checkins')}</div>
        <strong style={{ fontSize: 24 }}>{metrics.carsThisWeek}</strong>
      </div>
      <div className="card">
        <div>{t('metric_today_revenue')}</div>
        <strong style={{ fontSize: 24 }}>${metrics.profitToday.toFixed(2)}</strong>
      </div>
      <div className="card">
        <div>{t('metric_week_revenue')}</div>
        <strong style={{ fontSize: 24 }}>${metrics.profitThisWeek.toFixed(2)}</strong>
      </div>
    </div>
  );
}
