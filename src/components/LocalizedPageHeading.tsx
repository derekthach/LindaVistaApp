'use client';

import { useTranslation } from '@/lib/i18n/useTranslation';
import type { TranslationKey } from '@/lib/i18n/translations';

export default function LocalizedPageHeading({
  titleKey,
  subtitleKey,
  subtitleParams,
}: {
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  subtitleParams?: Record<string, string | number>;
}) {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="page-title">{t(titleKey)}</h1>
      <p className="page-subtitle">{t(subtitleKey, subtitleParams)}</p>
    </>
  );
}
