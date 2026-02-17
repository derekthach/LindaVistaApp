import { redirect } from 'next/navigation';
import { requireAuth } from '@/server/auth/session';
import AppLayout from '@/components/AppLayout';
import FoodBeerValidateClient from '@/components/checkins/FoodBeerValidateClient';

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
        <h1 className="page-title">
          {type === 'food' ? 'Food & Beverage' : 'Beer'} — Review
        </h1>
        <p className="page-subtitle">Review the information before submitting</p>
        <FoodBeerValidateClient type={type as 'food' | 'beer'} />
      </div>
    </AppLayout>
  );
}
