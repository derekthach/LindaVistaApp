import { requireAuth } from '@/server/auth/session';
import AppLayout from '@/components/AppLayout';
import DashboardCharts from '@/components/DashboardCharts';
import DashboardLogger from '@/components/DashboardLogger';
import DashboardEnsureAdminCookie from '@/components/DashboardEnsureAdminCookie';
import LocalizedPageHeading from '@/components/LocalizedPageHeading';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await requireAuth('admin');

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
        <DashboardCharts />
      </div>
    </AppLayout>
  );
}
