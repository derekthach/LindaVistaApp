'use client';

import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import LineChart from './charts/LineChart';
import BarChart from './charts/BarChart';
import DashboardSummaryCards from '@/components/DashboardSummaryCards';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type {
  DashboardBundleResponse,
  DashboardData,
  RoomUsageData,
  MonthlyComparisonData,
  EmployeeRoomActivityData,
  SummaryMetrics,
} from '@/types';

const ZONE = 'America/Puerto_Rico';
const MONTH_KEY_SUFFIXES = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;
function roomUsageYearOptions(): number[] {
  const y = DateTime.now().setZone(ZONE).year;
  return [y - 2, y - 1, y, y + 1, y + 2];
}

const EMPTY_DASHBOARD: DashboardData = {
  dates: [],
  checkins: [],
  revenue: [],
};
const EMPTY_ROOM_USAGE: RoomUsageData = { room_numbers: [], usage_counts: [] };
const EMPTY_EMPLOYEE_ACTIVITY: EmployeeRoomActivityData = {
  check_ins: { labels: [], counts: [] },
  cleanups: { labels: [], counts: [] },
};

const DEFAULT_METRICS: SummaryMetrics = {
  carsToday: 0,
  carsThisWeek: 0,
  profitToday: 0,
  profitThisWeek: 0,
};

function emptyMonthly(month: number, year: number, monthName: string, prevMonthName: string): MonthlyComparisonData {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return {
    current_month: { name: monthName, year, total: 0, car_count: 0 },
    prev_month: { name: prevMonthName, year: prevYear, total: 0, car_count: 0 },
    years_available: [String(year)],
  };
}

export default function DashboardCharts() {
  const { t } = useTranslation();
  const monthLabel = (m: number) => t(`month_short_${MONTH_KEY_SUFFIXES[m - 1]}` as 'month_short_jan');
  const [metrics, setMetrics] = useState<SummaryMetrics>(DEFAULT_METRICS);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [roomUsage, setRoomUsage] = useState<RoomUsageData | null>(null);
  const [bundleLoading, setBundleLoading] = useState(true);
  const [roomUsageMonth, setRoomUsageMonth] = useState(() =>
    DateTime.now().setZone(ZONE).month
  );
  const [roomUsageYear, setRoomUsageYear] = useState(() =>
    DateTime.now().setZone(ZONE).year
  );
  const [monthly, setMonthly] = useState<MonthlyComparisonData | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [employeeActivity, setEmployeeActivity] = useState<EmployeeRoomActivityData | null>(null);

  useEffect(() => {
    setBundleLoading(true);
    const params = new URLSearchParams({
      roomMonth: String(roomUsageMonth),
      roomYear: String(roomUsageYear),
      revenueMonth: String(month),
      revenueYear: String(year),
    });
    const prevCalMonth = month === 1 ? 12 : month - 1;
    const fallback = emptyMonthly(month, year, monthLabel(month), monthLabel(prevCalMonth));

    fetch(`/api/dashboard/bundle?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: DashboardBundleResponse | null) => {
        if (!data) {
          setMetrics(DEFAULT_METRICS);
          setDashboard(EMPTY_DASHBOARD);
          setRoomUsage(EMPTY_ROOM_USAGE);
          setMonthly(fallback);
          setEmployeeActivity(EMPTY_EMPLOYEE_ACTIVITY);
          setBundleLoading(false);
          return;
        }
        setMetrics(data.summaryMetrics);
        setDashboard(data.sevenDayTrend);
        setRoomUsage(data.roomUsage);
        setMonthly({
          ...data.monthlyRevenue,
          current_month: {
            ...data.monthlyRevenue.current_month,
            name: monthLabel(month),
          },
          prev_month: {
            ...data.monthlyRevenue.prev_month,
            name: monthLabel(prevCalMonth),
          },
        });
        setEmployeeActivity(data.employeeRoomActivity);
        setBundleLoading(false);
      })
      .catch(() => {
        setMetrics(DEFAULT_METRICS);
        setDashboard(EMPTY_DASHBOARD);
        setRoomUsage(EMPTY_ROOM_USAGE);
        setMonthly(fallback);
        setEmployeeActivity(EMPTY_EMPLOYEE_ACTIVITY);
        setBundleLoading(false);
      });
  }, [roomUsageMonth, roomUsageYear, month, year, t]);

  const localizeRoomChartLabel = (label: string) =>
    label.replace(/^Room\s+/i, `${t('room')} `);

  return (
    <>
      <DashboardSummaryCards metrics={metrics} />
      <div style={{ display: 'grid', gap: 24, marginTop: 24 }}>
      <section>
        <h2 style={{ marginBottom: 12 }}>{t('trend_analytics')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          <div className="card" style={{ height: 320 }}>
            <h3>{t('chart_room_checkins_7d')}</h3>
            <div style={{ height: 240 }}>
              {dashboard && dashboard.dates.length > 0 ? (
                <LineChart
                  labels={dashboard.dates}
                  data={dashboard.checkins}
                  label={t('chart_label_room_checkins')}
                />
              ) : (
                <p style={{ color: '#6b7280', padding: 24 }}>{t('chart_no_checkins_7d')}</p>
              )}
            </div>
          </div>
          <div className="card" style={{ height: 320 }}>
            <h3>{t('chart_revenue_7d')}</h3>
            <div style={{ height: 240 }}>
              {dashboard && dashboard.dates.length > 0 ? (
                <BarChart
                  labels={dashboard.dates}
                  data={dashboard.revenue}
                  label={t('chart_revenue_axis')}
                />
              ) : (
                <p style={{ color: '#6b7280', padding: 24 }}>{t('chart_no_revenue_7d')}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 style={{ marginBottom: 12 }}>{t('detailed_analytics')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          <div className="card" style={{ height: 360 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>{t('chart_room_usage_top')}</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={roomUsageMonth}
                  onChange={(e) => setRoomUsageMonth(parseInt(e.target.value, 10))}
                  style={{
                    height: 36,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 14,
                    minWidth: 72,
                  }}
                >
                  {MONTH_KEY_SUFFIXES.map((suffix, i) => (
                    <option key={suffix} value={i + 1}>
                      {t(`month_short_${suffix}` as 'month_short_jan')}
                    </option>
                  ))}
                </select>
                <select
                  value={roomUsageYear}
                  onChange={(e) => setRoomUsageYear(parseInt(e.target.value, 10))}
                  style={{
                    height: 36,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 14,
                    minWidth: 72,
                  }}
                >
                  {roomUsageYearOptions().map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ height: 280 }}>
              {bundleLoading ? (
                <p style={{ color: '#6b7280', padding: 24 }}>{t('loading')}</p>
              ) : roomUsage && roomUsage.room_numbers.length > 0 ? (
                <BarChart
                  labels={roomUsage.room_numbers.map(localizeRoomChartLabel)}
                  data={roomUsage.usage_counts}
                  label={t('chart_usage_count')}
                  color="rgba(22, 163, 74, 1)"
                  horizontal
                />
              ) : (
                <p style={{ color: '#6b7280', padding: 24 }}>{t('chart_no_room_usage_month')}</p>
              )}
            </div>
          </div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <h3>{t('chart_monthly_revenue')}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))}>
                  {MONTH_KEY_SUFFIXES.map((suffix, i) => (
                    <option key={suffix} value={i + 1}>
                      {t(`month_short_${suffix}` as 'month_short_jan')}
                    </option>
                  ))}
                </select>
                <select value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}>
                  {(monthly?.years_available || [String(new Date().getFullYear())]).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {monthly && (
              <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
                <div className="card" style={{ background: '#f0fdf4' }}>
                  <strong>
                    {monthly.current_month.name} {monthly.current_month.year}
                  </strong>
                  <div>${monthly.current_month.total.toFixed(2)}</div>
                  <div>
                    {monthly.current_month.car_count} {t('room_checkins_count_suffix')}
                  </div>
                </div>
                <div style={{ textAlign: 'center', color: '#6b7280' }}>{t('vs')}</div>
                <div className="card" style={{ background: '#f8fafc' }}>
                  <strong>
                    {monthly.prev_month.name} {monthly.prev_month.year}
                  </strong>
                  <div>${monthly.prev_month.total.toFixed(2)}</div>
                  <div>
                    {monthly.prev_month.car_count} {t('room_checkins_count_suffix')}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <p style={{ margin: '16px 0 0', fontSize: 13, color: '#6b7280' }}>
          {t('chart_staff_same_month_note')}
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 16,
            marginTop: 12,
          }}
        >
          <div className="card" style={{ minHeight: 360 }}>
            <h3 style={{ margin: '0 0 12px' }}>{t('chart_checkins_by_staff')}</h3>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
              {t('chart_checkins_by_staff_help')}
            </p>
            <div style={{ height: 280 }}>
              {bundleLoading ? (
                <p style={{ color: '#6b7280', padding: 24 }}>{t('loading')}</p>
              ) : employeeActivity && employeeActivity.check_ins.labels.length > 0 ? (
                <BarChart
                  labels={employeeActivity.check_ins.labels}
                  data={employeeActivity.check_ins.counts}
                  label={t('chart_label_room_checkins')}
                  color="rgba(22, 163, 74, 1)"
                  horizontal
                />
              ) : (
                <p style={{ color: '#6b7280', padding: 24 }}>{t('chart_no_room_usage_month')}</p>
              )}
            </div>
          </div>
          <div className="card" style={{ minHeight: 360 }}>
            <h3 style={{ margin: '0 0 12px' }}>{t('chart_cleanups_by_staff')}</h3>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
              {t('chart_cleanups_by_staff_help')}
            </p>
            <div style={{ height: 280 }}>
              {bundleLoading ? (
                <p style={{ color: '#6b7280', padding: 24 }}>{t('loading')}</p>
              ) : employeeActivity && employeeActivity.cleanups.labels.length > 0 ? (
                <BarChart
                  labels={employeeActivity.cleanups.labels}
                  data={employeeActivity.cleanups.counts}
                  label={t('chart_rooms_cleaned')}
                  color="rgba(37, 99, 235, 1)"
                  horizontal
                />
              ) : (
                <p style={{ color: '#6b7280', padding: 24 }}>{t('chart_no_cleanups_month')}</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
    </>
  );
}
