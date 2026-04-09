'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { translations, type LanguageCode, type TranslationKey } from './translations';

export type { TranslationKey };

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`
  );
}

/** Replace "{make}"-style placeholders used in car make strings. */
export function interpolateMake(template: string, make: string): string {
  return template.replace(/\{make\}/g, make);
}

type Language = LanguageCode;

type I18nContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  defaultLanguage,
}: {
  children: ReactNode;
  /** When 'es', initial language is Spanish (e.g. employee default). */
  defaultLanguage?: Language;
}) {
  /**
   * Per-device only: `localStorage` is not synced across phones/laptops or user accounts.
   * Saved choice always wins so toggling English on one device never affects another.
   */
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('preferredLanguage') as Language | null;
      if (saved === 'en' || saved === 'es') return saved;
    }
    if (defaultLanguage === 'es') return 'es';
    return 'en';
  });

  useEffect(() => {
    const saved = localStorage.getItem('preferredLanguage') as Language | null;
    if (saved === 'en' || saved === 'es') {
      setLanguageState(saved);
      return;
    }
    if (defaultLanguage === 'es') setLanguageState('es');
  }, [defaultLanguage]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('preferredLanguage', lang);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      const bundle = translations[language];
      let raw = bundle[key] as string | undefined;
      if (raw === undefined) {
        if (typeof console !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.warn(`[i18n] Missing key "${String(key)}" for locale "${language}"`);
        }
        raw = translations.en[key] as string | undefined;
        if (raw === undefined) {
          if (typeof console !== 'undefined' && process.env.NODE_ENV === 'development') {
            console.warn(`[i18n] Missing key "${String(key)}" in English fallback`);
          }
          return String(key);
        }
      }
      return interpolate(raw, params);
    },
    [language]
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}

/** @deprecated Prefer useTranslation */
export function useLanguage() {
  return useI18n();
}
