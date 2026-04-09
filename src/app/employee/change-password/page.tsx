import { requireAuth } from '@/server/auth/session';
import EmployeeChangePasswordPageClient from '@/components/EmployeeChangePasswordPageClient';

export const dynamic = 'force-dynamic';

export default async function EmployeeChangePasswordPage() {
  await requireAuth(undefined, 'change-password');

  return <EmployeeChangePasswordPageClient />;
}
