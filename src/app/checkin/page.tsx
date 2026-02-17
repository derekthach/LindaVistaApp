import { redirect } from 'next/navigation';

/** Backwards compatibility: redirect old /checkin to type selector */
export default function CheckinPage() {
  redirect('/checkins/new');
}
