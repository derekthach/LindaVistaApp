import { redirect } from 'next/navigation';
import { requireAuth } from '@/server/auth/session';
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

  return (
    <AppLayout role={session.role}>
      <div className="container">
        <FoodBeerValidatePageHeading type={type as 'food' | 'beer'} />
        <FoodBeerValidateClient
          type={type as 'food' | 'beer'}
          staffDisplayOverride={
            session.role === 'employee' ? session.displayName ?? session.username : undefined
          }
        />
      </div>
    </AppLayout>
  );
}
