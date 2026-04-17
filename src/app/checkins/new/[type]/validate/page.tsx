import { redirect } from 'next/navigation';
import { requireAuth } from '@/server/auth/session';
import { isGuestEmployeeUsername } from '@/lib/auth/guestEmployee';
import AppLayout from '@/components/AppLayout';
import FoodBeerValidateClient from '@/components/checkins/FoodBeerValidateClient';
import FoodBeerValidatePageHeading from '@/components/checkins/FoodBeerValidatePageHeading';

interface PageProps {
  params: Promise<{ type: string }>;
}

export default async function ValidateCheckinPage({ params }: PageProps) {
  const session = await requireAuth();
  const { type } = await params;

  if (type !== 'food' && type !== 'beer') {
    redirect('/checkins/new');
  }

  const hideStaffOverrideForGuest =
    session.role === 'employee' && isGuestEmployeeUsername(session.username);

  return (
    <AppLayout
      role={session.role}
      employeeGreetingName={
        session.role === 'employee' ? (session.displayName ?? session.username) : undefined
      }
    >
      <div className="container">
        <FoodBeerValidatePageHeading type={type as 'food' | 'beer'} />
        <FoodBeerValidateClient
          type={type as 'food' | 'beer'}
          staffDisplayOverride={
            hideStaffOverrideForGuest ? undefined : session.role === 'employee'
              ? session.displayName ?? session.username
              : undefined
          }
        />
      </div>
    </AppLayout>
  );
}
