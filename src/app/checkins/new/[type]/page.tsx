import { notFound } from 'next/navigation';
import { requireAuth } from '@/server/auth/session';
import AppLayout from '@/components/AppLayout';
import { isCheckInType } from '@/lib/checkins/types';
import RoomCheckinForm from '@/components/checkins/RoomCheckinForm';
import SimpleCheckinForm from '@/components/checkins/SimpleCheckinForm';
import CheckinFormPageHeading from '@/components/checkins/CheckinFormPageHeading';
import CheckinFormBackButton from '@/components/checkins/CheckinFormBackButton';
import { listActiveOccupiedRoomCheckins } from '@/lib/server/checkinsRepo';
import { getOccupiedRoomIdsFromCheckins } from '@/lib/checkins/roomOccupancy';

interface PageProps {
  params: Promise<{ type: string }>;
}

export default async function NewCheckinByTypePage({ params }: PageProps) {
  const session = await requireAuth();
  const { type } = await params;

  if (!isCheckInType(type)) {
    notFound();
  }

  let occupiedRoomIds: string[] = [];
  if (type === 'room') {
    const active = await listActiveOccupiedRoomCheckins();
    occupiedRoomIds = Array.from(getOccupiedRoomIdsFromCheckins(active));
  }

  return (
    <AppLayout
      role={session.role}
      employeeGreetingName={
        session.role === 'employee' ? (session.displayName ?? session.username) : undefined
      }
    >
      <div className="container">
        <CheckinFormBackButton />
        <CheckinFormPageHeading type={type} />
        {type === 'room' && (
          <RoomCheckinForm
            isAdmin={session.role === 'admin'}
            occupiedRoomIds={occupiedRoomIds}
            employeeDisplayName={session.displayName ?? session.username}
          />
        )}
        {(type === 'food' || type === 'beer') && (
          <SimpleCheckinForm
            type={type}
            isAdmin={session.role === 'admin'}
            employeeDisplayName={session.displayName ?? session.username}
          />
        )}
      </div>
    </AppLayout>
  );
}
