import { redirect } from 'next/navigation';
import { requireAuth } from '@/server/auth/session';
import { isGuestEmployeeUsername } from '@/lib/auth/guestEmployee';
import AppLayout from '@/components/AppLayout';
import LocalizedPageHeading from '@/components/LocalizedPageHeading';
import EmployeeRecentCheckinsSection from '@/components/checkins/EmployeeRecentCheckinsSection';
import { EMPLOYEE_ENTRY_ACCESS_HOURS } from '@/lib/checkins/employeeAccess';

export default async function EmployeeRecentCheckinsPage() {
  const session = await requireAuth();
  if (session.role !== 'employee') {
    redirect('/dashboard');
  }
  if (isGuestEmployeeUsername(session.username)) {
    redirect('/checkins/new');
  }

  const employeeGreetingName = session.displayName ?? session.username;

  return (
    <AppLayout role={session.role} employeeGreetingName={employeeGreetingName} employeeUsername={session.username}>
      <div className="container">
        <LocalizedPageHeading
          titleKey="employee_recent_checkins_title"
          subtitleKey="employee_recent_checkins_subtitle"
          subtitleParams={{ hours: EMPLOYEE_ENTRY_ACCESS_HOURS }}
        />
        <EmployeeRecentCheckinsSection guestManualStaffEntry={false} omitHeading />
      </div>
    </AppLayout>
  );
}
