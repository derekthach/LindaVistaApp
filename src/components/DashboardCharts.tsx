'use client';

import { useEffect, useState } from 'react';
import LineChart from './charts/LineChart';
import BarChart from './charts/BarChart';
import type { DashboardData, RoomUsageData, MonthlyComparisonData } from '@/types';

const EMPTY_DASHBOARD: DashboardData = {
  dates: [],
  checkins: [],
  revenue: [],
};
const EMPTY_ROOM_USAGE: RoomUsageData = { room_numbers: [], usage_counts: [] };

function emptyMonthly(month: number, year: number): MonthlyComparisonData {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return {
    current_month: { name: months[month - 1], year, total: 0, car_count: 0 },
    prev_month: { name: months[prevMonth - 1], year: prevYear, total: 0, car_count: 0 },
    years_available: [String(year)],
  };
}

export default function DashboardCharts() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [roomUsage, setRoomUsage] = useState<RoomUsageData | null>(null);
  const [monthly, setMonthly] = useState<MonthlyComparisonData | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => (res.ok ? res.json() : EMPTY_DASHBOARD))
      .then(setDashboard)
      .catch(() => setDashboard(EMPTY_DASHBOARD));

    fetch('/api/room-usage')
      .then((res) => (res.ok ? res.json() : EMPTY_ROOM_USAGE))
      .then(setRoomUsage)
      .catch(() => setRoomUsage(EMPTY_ROOM_USAGE));
  }, []);

  useEffect(() => {
    fetch(`/api/monthly-revenue?month=${month}&year=${year}`)
      .then((res) => (res.ok ? res.json() : emptyMonthly(month, year)))
      .then(setMonthly)
      .catch(() => setMonthly(emptyMonthly(month, year)));
  }, [month, year]);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section>
        <h2 style={{ marginBottom: 12 }}>Trend Analytics</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          <div className="card" style={{ height: 320 }}>
            <h3>Check-Ins Over Time (7 days)</h3>
            <div style={{ height: 240 }}>
              {dashboard && dashboard.dates.length > 0 ? (
                <LineChart labels={dashboard.dates} data={dashboard.checkins} label="Check-ins" />
              ) : (
                <p style={{ color: '#6b7280', padding: 24 }}>No check-ins in the last 7 days.</p>
              )}
            </div>
          </div>
          <div className="card" style={{ height: 320 }}>
            <h3>Revenue Over Time (7 days)</h3>
            <div style={{ height: 240 }}>
              {dashboard && dashboard.dates.length > 0 ? (
                <BarChart labels={dashboard.dates} data={dashboard.revenue} label="Revenue ($)" />
              ) : (
                <p style={{ color: '#6b7280', padding: 24 }}>No revenue data in the last 7 days.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 style={{ marginBottom: 12 }}>Detailed Analytics</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          <div className="card" style={{ height: 360 }}>
            <h3>Room Usage Frequency (Top 15)</h3>
            <div style={{ height: 280 }}>
              {roomUsage && roomUsage.room_numbers.length > 0 ? (
                <BarChart
                  labels={roomUsage.room_numbers}
                  data={roomUsage.usage_counts}
                  label="Usage Count"
                  color="rgba(22, 163, 74, 1)"
                  horizontal
                />
              ) : (
                <p style={{ color: '#6b7280', padding: 24 }}>No room usage data yet.</p>
              )}
            </div>
          </div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <h3>Monthly Revenue</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))}>
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(
                    (m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    )
                  )}
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
                  <div>{monthly.current_month.car_count} check-ins</div>
                </div>
                <div style={{ textAlign: 'center', color: '#6b7280' }}>vs</div>
                <div className="card" style={{ background: '#f8fafc' }}>
                  <strong>
                    {monthly.prev_month.name} {monthly.prev_month.year}
                  </strong>
                  <div>${monthly.prev_month.total.toFixed(2)}</div>
                  <div>{monthly.prev_month.car_count} check-ins</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
