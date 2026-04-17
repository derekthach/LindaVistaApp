'use client';

import CheckinForm from '@/components/CheckinForm';

/** Room check-in form (existing full form) at /checkins/new/room */
export default function RoomCheckinForm({
  isAdmin,
  occupiedRoomIds = [],
  employeeDisplayName,
  guestManualStaffEntry = false,
}: {
  isAdmin?: boolean;
  /** Room numbers (strings) with an active stay — excluded from the room dropdown. */
  occupiedRoomIds?: string[];
  /** When set (employee), staff field is read-only. */
  employeeDisplayName?: string;
  /** Shared Guest login: employee types staff name each time. */
  guestManualStaffEntry?: boolean;
}) {
  return (
    <CheckinForm
      allowAddCarMake={isAdmin}
      allowEditDateTime={isAdmin}
      occupiedRoomIds={occupiedRoomIds}
      lockedStaffName={!isAdmin && !guestManualStaffEntry ? employeeDisplayName : undefined}
      guestManualStaffEntry={guestManualStaffEntry}
    />
  );
}
