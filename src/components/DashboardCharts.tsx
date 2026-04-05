'use client';

import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import LineChart from './charts/LineChart';
import BarChart from './charts/BarChart';
import type {
  DashboardData,
  RoomUsageData,
  MonthlyComparisonData,
  EmployeeRoomActivityData,
} from '@/types';

const ZONE = 'America/Puerto_Rico';
const MONTH_OPTIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
  const [roomUsageLoading, setRoomUsageLoading] = useState(true);
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
  const [employeeActivityLoading, setEmployeeActivityLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => (res.ok ? res.json() : EMPTY_DASHBOARD))
      .then(setDashboard)
      .catch(() => setDashboard(EMPTY_DASHBOARD));
  }, []);

  useEffect(() => {
    setRoomUsageLoading(true);
    fetch(`/api/room-usage?month=${roomUsageMonth}&year=${roomUsageYear}`)
      .then((res) => (res.ok ? res.json() : EMPTY_ROOM_USAGE))
      .then((data) => {
        setRoomUsage(data);
        setRoomUsageLoading(false);
      })
      .catch(() => {
        setRoomUsage(EMPTY_ROOM_USAGE);
        setRoomUsageLoading(false);
      });
  }, [roomUsageMonth, roomUsageYear]);

  useEffect(() => {
    setEmployeeActivityLoading(true);
    fetch(
      `/api/dashboard/employee-room-activity?month=${roomUsageMonth}&year=${roomUsageYear}`
    )
      .then((res) => (res.ok ? res.json() : EMPTY_EMPLOYEE_ACTIVITY))
      .then((data: EmployeeRoomActivityData) => {
        setEmployeeActivity(data);
        setEmployeeActivityLoading(false);
      })
      .catch(() => {
        setEmployeeActivity(EMPTY_EMPLOYEE_ACTIVITY);
        setEmployeeActivityLoading(false);
      });
  }, [roomUsageMonth, roomUsageYear]);

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
            <h3>Room check-ins (7 days)</h3>
            <div style={{ height: 240 }}>
              {dashboard && dashboard.dates.length > 0 ? (
                <LineChart labels={dashboard.dates} data={dashboard.checkins} label="Room check-ins" />
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Room Usage Frequency (Top 15)</h3>
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
                  {MONTH_OPTIONS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
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
              {roomUsageLoading ? (
                <p style={{ color: '#6b7280', padding: 24 }}>Loading…</p>
              ) : roomUsage && roomUsage.room_numbers.length > 0 ? (
                <BarChart
                  labels={roomUsage.room_numbers}
                  data={roomUsage.usage_counts}
                  label="Usage Count"
                  color="rgba(22, 163, 74, 1)"
                  horizontal
                />
              ) : (
                <p style={{ color: '#6b7280', padding: 24 }}>No room check-ins for this month.</p>
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
                  <div>{monthly.current_month.car_count} room check-ins</div>
                </div>
                <div style={{ textAlign: 'center', color: '#6b7280' }}>vs</div>
                <div className="card" style={{ background: '#f8fafc' }}>
                  <strong>
                    {monthly.prev_month.name} {monthly.prev_month.year}
                  </strong>
                  <div>${monthly.prev_month.total.toFixed(2)}</div>
                  <div>{monthly.prev_month.car_count} room check-ins</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <p style={{ margin: '16px 0 0', fontSize: 13, color: '#6b7280' }}>
          Staff charts below use the same month and year as &quot;Room Usage Frequency&quot;.
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
            <h3 style={{ margin: '0 0 12px' }}>Room check-ins by staff</h3>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
              Guest room stays recorded in this month (who checked the guest in).
            </p>
            <div style={{ height: 280 }}>
              {employeeActivityLoading ? (
                <p style={{ color: '#6b7280', padding: 24 }}>Loading…</p>
              ) : employeeActivity && employeeActivity.check_ins.labels.length > 0 ? (
                <BarChart
                  labels={employeeActivity.check_ins.labels}
                  data={employeeActivity.check_ins.counts}
                  label="Room check-ins"
                  color="rgba(22, 163, 74, 1)"
                  horizontal
                />
              ) : (
                <p style={{ color: '#6b7280', padding: 24 }}>No room check-ins for this month.</p>
              )}
            </div>
          </div>
          <div className="card" style={{ minHeight: 360 }}>
            <h3 style={{ margin: '0 0 12px' }}>Rooms cleaned by staff</h3>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
              Checkouts completed in this month (who cleaned / verified the room).
            </p>
            <div style={{ height: 280 }}>
              {employeeActivityLoading ? (
                <p style={{ color: '#6b7280', padding: 24 }}>Loading…</p>
              ) : employeeActivity && employeeActivity.cleanups.labels.length > 0 ? (
                <BarChart
                  labels={employeeActivity.cleanups.labels}
                  data={employeeActivity.cleanups.counts}
                  label="Rooms cleaned"
                  color="rgba(37, 99, 235, 1)"
                  horizontal
                />
              ) : (
                <p style={{ color: '#6b7280', padding: 24 }}>
                  No cleanups recorded for this month. If this stays empty, confirm Firestore has{' '}
                  <code style={{ fontSize: 12 }}>checkedOutAt</code> and{' '}
                  <code style={{ fontSize: 12 }}>cleanedBy</code> on checked-out room stays.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
