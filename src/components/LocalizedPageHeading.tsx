'use client';

import { useTranslation } from '@/lib/i18n/useTranslation';
import type { TranslationKey } from '@/lib/i18n/translations';

export default function LocalizedPageHeading({
  titleKey,
  subtitleKey,
}: {
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
}) {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="page-title">{t(titleKey)}</h1>
      <p className="page-subtitle">{t(subtitleKey)}</p>
    </>
  );
}
