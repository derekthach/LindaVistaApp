import { requireAuth } from '@/server/auth/session';
import { getSummaryMetrics } from '@/lib/server/checkinsRepo';
import AppLayout from '@/components/AppLayout';
import DashboardCharts from '@/components/DashboardCharts';
import DashboardLogger from '@/components/DashboardLogger';
import DashboardEnsureAdminCookie from '@/components/DashboardEnsureAdminCookie';

export const dynamic = 'force-dynamic';

const DEFAULT_METRICS = {
  carsToday: 0,
  carsThisWeek: 0,
  profitToday: 0,
  profitThisWeek: 0,
};

export default async function DashboardPage() {
  const session = await requireAuth('admin');
  let metrics = DEFAULT_METRICS;
  try {
    metrics = await getSummaryMetrics();
  } catch {
    // Firestore/auth may be unavailable; show zeros so the page still loads
  }

  return (
    <AppLayout role={session.role}>
      <DashboardEnsureAdminCookie />
      <DashboardLogger />
      <div className="container">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of motel activity</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div className="card">
            <div>Today's Check-Ins</div>
            <strong style={{ fontSize: 24 }}>{metrics.carsToday}</strong>
          </div>
          <div className="card">
            <div>Weekly Check-Ins</div>
            <strong style={{ fontSize: 24 }}>{metrics.carsThisWeek}</strong>
          </div>
          <div className="card">
            <div>Today's Revenue</div>
            <strong style={{ fontSize: 24 }}>${metrics.profitToday.toFixed(2)}</strong>
          </div>
          <div className="card">
            <div>Weekly Revenue</div>
            <strong style={{ fontSize: 24 }}>${metrics.profitThisWeek.toFixed(2)}</strong>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <DashboardCharts />
        </div>
      </div>
    </AppLayout>
  );
}
