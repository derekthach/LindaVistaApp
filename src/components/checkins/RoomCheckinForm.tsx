'use client';

import CheckinForm from '@/components/CheckinForm';

/** Room check-in form (existing full form) at /checkins/new/room */
export default function RoomCheckinForm({ isAdmin }: { isAdmin?: boolean }) {
  return <CheckinForm allowAddCarMake={isAdmin} allowEditDateTime={isAdmin} />;
}
