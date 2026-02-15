import { requireAuth } from '@/server/auth/session';
import { getSummaryMetrics } from '@/lib/server/checkinsRepo';
import AppLayout from '@/components/AppLayout';
import DashboardCharts from '@/components/DashboardCharts';

const EMPTY_METRICS = {
  carsToday: 0,
  carsThisWeek: 0,
  profitToday: 0,
  profitThisWeek: 0,
};

export default async function DashboardPage() {
  const session = await requireAuth('admin');
  let metrics = EMPTY_METRICS;
  let metricsError: string | null = null;
  try {
    metrics = await getSummaryMetrics();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isAuthError =
      message.includes('invalid_grant') ||
      message.includes('invalid_rapt') ||
      message.includes('Getting metadata from plugin');
    metricsError = isAuthError
      ? 'Dashboard data unavailable: Firebase credentials need to be set or re-authenticated. For local dev, add FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY + GOOGLE_CLOUD_PROJECT) to .env.local, or run: gcloud auth application-default login'
      : `Could not load dashboard data: ${message}`;
  }

  return (
    <AppLayout role={session.role}>
      <div className="container">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of motel activity</p>

        {metricsError && (
          <div
            role="alert"
            style={{
              padding: 12,
              marginBottom: 16,
              background: 'rgba(255, 193, 7, 0.15)',
              border: '1px solid rgba(255, 193, 7, 0.5)',
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            {metricsError}
          </div>
        )}

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
