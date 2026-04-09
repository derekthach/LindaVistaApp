'use client';

import { useTranslation } from '@/lib/i18n/useTranslation';
import { LanguageToggle } from '@/components/LanguageToggle';
import LoginForgotPassword from '@/components/LoginForgotPassword';

export default function LoginPageContent({ configError }: { configError: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      {configError && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            maxWidth: 480,
            padding: 16,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            color: '#991b1b',
            fontSize: 14,
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
        >
          <strong>{t('config_error_title')}</strong> {t('config_error_body')}
        </div>
      )}
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          backgroundImage: 'url(/logo1p.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.75)',
            zIndex: 0,
          }}
          aria-hidden
        />
        <div className="card" style={{ width: 420, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <LanguageToggle />
          </div>
          <h1 className="page-title">{t('login_title')}</h1>
          <p className="page-subtitle">{t('login_subtitle')}</p>

          <form action="/api/auth/login" method="POST" style={{ display: 'grid', gap: 16 }}>
            <label>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('username')}</div>
              <input
                name="username"
                type="text"
                required
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
              />
            </label>

            <label>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('password')}</div>
              <input
                name="password"
                type="password"
                required
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
              />
            </label>

            <button
              type="submit"
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: 'none',
                background: '#166534',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('sign_in')}
            </button>
          </form>

          <LoginForgotPassword />
        </div>
      </div>
    </>
  );
}
