'use client';

import CheckinForm from '@/components/CheckinForm';

/** Room check-in form (existing full form) at /checkins/new/room */
export default function RoomCheckinForm({
  isAdmin,
  occupiedRoomIds = [],
  employeeDisplayName,
}: {
  isAdmin?: boolean;
  /** Room numbers (strings) with an active stay — excluded from the room dropdown. */
  occupiedRoomIds?: string[];
  /** When set (employee), staff field is read-only. */
  employeeDisplayName?: string;
}) {
  return (
    <CheckinForm
      allowAddCarMake={isAdmin}
      allowEditDateTime={isAdmin}
      occupiedRoomIds={occupiedRoomIds}
      lockedStaffName={!isAdmin ? employeeDisplayName : undefined}
    />
  );
}
