'use client';

import SessionTouchOnNavigate from '@/components/SessionTouchOnNavigate';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import ChangePasswordForm from '@/components/ChangePasswordForm';
import { useTranslation } from '@/lib/i18n/useTranslation';

function ChangePasswordHeading() {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="page-title" style={{ fontSize: 22 }}>
        {t('change_password_page_title')}
      </h1>
      <p className="page-subtitle" style={{ marginBottom: 20 }}>
        {t('change_password_page_subtitle')}
      </p>
    </>
  );
}

export default function EmployeeChangePasswordPageClient() {
  return (
    <I18nProvider defaultLanguage="es">
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          background: '#f3f4f6',
        }}
      >
        <SessionTouchOnNavigate />
        <div className="card" style={{ width: '100%', maxWidth: 420 }}>
          <ChangePasswordHeading />
          <ChangePasswordForm />
        </div>
      </div>
    </I18nProvider>
  );
}
