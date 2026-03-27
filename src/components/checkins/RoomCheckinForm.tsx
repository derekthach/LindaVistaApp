'use client';

import CheckinForm from '@/components/CheckinForm';

/** Room check-in form (existing full form) at /checkins/new/room */
export default function RoomCheckinForm({
  isAdmin,
  occupiedRoomIds = [],
}: {
  isAdmin?: boolean;
  /** Room numbers (strings) with an active stay — excluded from the room dropdown. */
  occupiedRoomIds?: string[];
}) {
  return (
    <CheckinForm
      allowAddCarMake={isAdmin}
      allowEditDateTime={isAdmin}
      occupiedRoomIds={occupiedRoomIds}
    />
  );
}
