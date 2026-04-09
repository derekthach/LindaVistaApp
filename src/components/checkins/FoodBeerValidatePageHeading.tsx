'use client';

import { useTranslation } from '@/lib/i18n/useTranslation';
import type { TranslationKey } from '@/lib/i18n/translations';

export default function FoodBeerValidatePageHeading({ type }: { type: 'food' | 'beer' }) {
  const { t } = useTranslation();
  const titleKey: TranslationKey =
    type === 'food' ? 'validate_checkin_title_food' : 'validate_checkin_title_beer';
  return (
    <>
      <h1 className="page-title">{t(titleKey)}</h1>
      <p className="page-subtitle">{t('review_before_submitting')}</p>
    </>
  );
}
