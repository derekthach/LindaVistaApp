import { notFound } from 'next/navigation';
import { requireAuth } from '@/server/auth/session';
import AppLayout from '@/components/AppLayout';
import { isCheckInType } from '@/lib/checkins/types';
import RoomCheckinForm from '@/components/checkins/RoomCheckinForm';
import SimpleCheckinForm from '@/components/checkins/SimpleCheckinForm';
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
    <AppLayout role={session.role}>
      <div className="container">
        <h1 className="page-title">
          {type === 'room'
            ? 'Room Check-In'
            : type === 'food'
              ? 'Food & Beverage Check-In'
              : 'Beer Check-In'}
        </h1>
        <p className="page-subtitle">
          {type === 'room'
            ? 'Register a new guest check-in'
            : 'Register date, time, and staff'}
        </p>
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
