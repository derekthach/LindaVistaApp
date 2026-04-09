'use client';

import { useI18n } from './I18nProvider';

/**
 * Returns the active locale, setter, and `t(key)` for UI copy.
 * Alias of useI18n for clearer call sites.
 */
export function useTranslation() {
  return useI18n();
}

export { useI18n, useLanguage } from './I18nProvider';
export type { TranslationKey } from './translations';
