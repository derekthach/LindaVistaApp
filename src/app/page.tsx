import { redirect } from 'next/navigation';
import { assertSessionValidForPageOrRedirect, getSession } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getSession();

  if (!session.isLoggedIn || !session.username) {
    redirect('/login');
  }

  assertSessionValidForPageOrRedirect(session);

  if (session.mustChangePassword) {
    redirect('/employee/change-password');
  }

  redirect(session.role === 'admin' ? '/dashboard' : '/checkins/new');
}
