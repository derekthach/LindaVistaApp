'use client';

import { useTranslation } from '@/lib/i18n/useTranslation';
import type { TranslationKey } from '@/lib/i18n/translations';

export default function CheckinFormPageHeading({ type }: { type: 'room' | 'food' | 'beer' }) {
  const { t } = useTranslation();
  const titleKey: TranslationKey =
    type === 'room' ? 'room_checkin_title' : type === 'food' ? 'food_checkin_title' : 'beer_checkin_title';
  const subtitleKey: TranslationKey =
    type === 'room' ? 'room_checkin_subtitle' : 'simple_checkin_subtitle';
  return (
    <>
      <h1 className="page-title">{t(titleKey)}</h1>
      <p className="page-subtitle">{t(subtitleKey)}</p>
    </>
  );
}
