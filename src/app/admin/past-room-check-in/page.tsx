import { redirect } from 'next/navigation';

/** Old URL: keep bookmarks working. */
export default function PastRoomCheckInRedirectPage() {
  redirect('/admin/add-past-entry');
}
