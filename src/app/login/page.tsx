import { redirect } from 'next/navigation';
import { flushStaleSessionOnLoginPage, getSession } from '@/server/auth/session';
import LoginPageLogger from '@/components/LoginPageLogger';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import LoginPageContent from '@/components/LoginPageContent';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ error?: string }>;

type LoginAuthError = 'missing' | 'invalid' | 'server';

function parseAuthError(error: string | undefined): LoginAuthError | undefined {
  if (error === 'missing' || error === 'invalid' || error === 'server') return error;
  return undefined;
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  await flushStaleSessionOnLoginPage();
  const session = await getSession();
  if (session.isLoggedIn && session.username) {
    if (session.mustChangePassword) {
      redirect('/employee/change-password');
    }
    redirect(session.role === 'admin' ? '/dashboard' : '/checkins/new');
  }

  const params = await searchParams;
  const configError = params.error === 'config';
  const authError = parseAuthError(params.error);

  return (
    <>
      <LoginPageLogger />
      <I18nProvider>
        <LoginPageContent configError={configError} authError={authError} />
      </I18nProvider>
    </>
  );
}
