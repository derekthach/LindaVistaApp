import { requireAuth } from '@/server/auth/session';
import { getSummaryMetrics } from '@/lib/server/checkinsRepo';
import AppLayout from '@/components/AppLayout';
import DashboardCharts from '@/components/DashboardCharts';
import DashboardLogger from '@/components/DashboardLogger';
import DashboardEnsureAdminCookie from '@/components/DashboardEnsureAdminCookie';
import LocalizedPageHeading from '@/components/LocalizedPageHeading';
import DashboardSummaryCards from '@/components/DashboardSummaryCards';

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
    <AppLayout
      role={session.role}
      employeeGreetingName={
        session.role === 'employee' ? (session.displayName ?? session.username) : undefined
      }
    >
      <DashboardEnsureAdminCookie />
      <DashboardLogger />
      <div className="container">
        <LocalizedPageHeading titleKey="dashboard_title" subtitleKey="dashboard_subtitle" />
        <DashboardSummaryCards metrics={metrics} />

        <div style={{ marginTop: 24 }}>
          <DashboardCharts />
        </div>
      </div>
    </AppLayout>
  );
}
