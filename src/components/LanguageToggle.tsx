'use client';

import { useTranslation } from '@/lib/i18n/useTranslation';

export { I18nProvider as LanguageProvider } from '@/lib/i18n/I18nProvider';
export { useLanguage, useI18n } from '@/lib/i18n/I18nProvider';
export type { TranslationKey } from '@/lib/i18n/translations';

export function LanguageToggle() {
  const { language, setLanguage, t } = useTranslation();

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
      <span style={{ fontWeight: language === 'en' ? 700 : 400 }}>{t('english')}</span>
      <button
        type="button"
        onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
        style={{
          width: 44,
          height: 22,
          borderRadius: 999,
          border: 'none',
          background: '#16a34a',
          position: 'relative',
          cursor: 'pointer',
        }}
        aria-label={language === 'en' ? t('spanish') : t('english')}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: language === 'es' ? 24 : 4,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.15s ease',
          }}
        />
      </button>
      <span style={{ fontWeight: language === 'es' ? 700 : 400 }}>{t('spanish')}</span>
    </div>
  );
}
