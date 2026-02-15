'use client';

import { useEffect, useState } from 'react';
import LineChart from './charts/LineChart';
import BarChart from './charts/BarChart';
import type { DashboardData, RoomUsageData, MonthlyComparisonData } from '@/types';

function isDashboardData(v: unknown): v is DashboardData {
  return (
    !!v &&
    typeof v === 'object' &&
    Array.isArray((v as DashboardData).dates) &&
    Array.isArray((v as DashboardData).checkins) &&
    Array.isArray((v as DashboardData).revenue)
  );
}

function isRoomUsageData(v: unknown): v is RoomUsageData {
  return (
    !!v &&
    typeof v === 'object' &&
    Array.isArray((v as RoomUsageData).room_numbers) &&
    Array.isArray((v as RoomUsageData).usage_counts)
  );
}

function isMonthlyComparisonData(v: unknown): v is MonthlyComparisonData {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  const curr = m.current_month;
  const prev = m.prev_month;
  return (
    !!curr &&
    typeof curr === 'object' &&
    typeof (curr as { name?: unknown }).name === 'string' &&
    typeof (curr as { total?: unknown }).total === 'number' &&
    !!prev &&
    typeof prev === 'object' &&
    typeof (prev as { name?: unknown }).name === 'string' &&
    typeof (prev as { total?: unknown }).total === 'number' &&
    Array.isArray(m.years_available)
  );
}

export default function DashboardCharts() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [roomUsage, setRoomUsage] = useState<RoomUsageData | null>(null);
  const [monthly, setMonthly] = useState<MonthlyComparisonData | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => (res.ok ? res.json() : Promise.resolve(null)))
      .then((data) => setDashboard(isDashboardData(data) ? data : null))
      .catch(() => setDashboard(null));

    fetch('/api/room-usage')
      .then((res) => (res.ok ? res.json() : Promise.resolve(null)))
      .then((data) => setRoomUsage(isRoomUsageData(data) ? data : null))
      .catch(() => setRoomUsage(null));
  }, []);

  useEffect(() => {
    fetch(`/api/monthly-revenue?month=${month}&year=${year}`)
      .then((res) => (res.ok ? res.json() : Promise.resolve(null)))
      .then((data) => setMonthly(isMonthlyComparisonData(data) ? data : null))
      .catch(() => setMonthly(null));
  }, [month, year]);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section>
        <h2 style={{ marginBottom: 12 }}>Trend Analytics</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          <div className="card" style={{ height: 320 }}>
            <h3>Check-Ins Over Time (7 days)</h3>
            <div style={{ height: 240 }}>
              <LineChart
                labels={dashboard?.dates ?? []}
                data={dashboard?.checkins ?? []}
                label="Check-ins"
              />
            </div>
          </div>
          <div className="card" style={{ height: 320 }}>
            <h3>Revenue Over Time (7 days)</h3>
            <div style={{ height: 240 }}>
              <BarChart
                labels={dashboard?.dates ?? []}
                data={dashboard?.revenue ?? []}
                label="Revenue ($)"
              />
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
              <BarChart
                labels={roomUsage?.room_numbers ?? []}
                data={roomUsage?.usage_counts ?? []}
                label="Usage Count"
                color="rgba(22, 163, 74, 1)"
                horizontal
              />
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
                  {(Array.isArray(monthly?.years_available) ? monthly.years_available : [String(new Date().getFullYear())]).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {monthly?.current_month && monthly?.prev_month ? (
              <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
                <div className="card" style={{ background: '#f0fdf4' }}>
                  <strong>
                    {monthly.current_month.name} {monthly.current_month.year}
                  </strong>
                  <div>${Number(monthly.current_month.total).toFixed(2)}</div>
                  <div>{monthly.current_month.car_count} check-ins</div>
                </div>
                <div style={{ textAlign: 'center', color: '#6b7280' }}>vs</div>
                <div className="card" style={{ background: '#f8fafc' }}>
                  <strong>
                    {monthly.prev_month.name} {monthly.prev_month.year}
                  </strong>
                  <div>${Number(monthly.prev_month.total).toFixed(2)}</div>
                  <div>{monthly.prev_month.car_count} check-ins</div>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 16, color: '#6b7280', fontSize: 14 }}>
                Monthly data unavailable.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
