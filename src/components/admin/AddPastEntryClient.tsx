'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PastRoomCheckinForm from '@/components/admin/PastRoomCheckinForm';
import PastFoodBeverageForm from '@/components/admin/PastFoodBeverageForm';
import PastBeerForm from '@/components/admin/PastBeerForm';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { TranslationKey } from '@/lib/i18n/translations';

type Tab = 'room' | 'food' | 'beer';

function tabFromParam(raw: string | null): Tab {
  if (raw === 'food') return 'food';
  if (raw === 'beer') return 'beer';
  return 'room';
}

export default function AddPastEntryClient({ staffNames }: { staffNames: string[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => tabFromParam(searchParams.get('tab')));

  useEffect(() => {
    setTab(tabFromParam(searchParams.get('tab')));
  }, [searchParams]);

  const setTabAndUrl = useCallback(
    (next: Tab) => {
      setTab(next);
      const suffix = next === 'room' ? '' : `?tab=${next}`;
      router.replace(`/admin/add-past-entry${suffix}`, { scroll: false });
    },
    [router]
  );

  const tabBtn = (id: Tab, labelKey: TranslationKey) => {
    const active = tab === id;
    return (
      <button
        type="button"
        key={id}
        onClick={() => setTabAndUrl(id)}
        style={{
          flex: 1,
          padding: '10px 14px',
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          background: active ? '#166534' : '#fff',
          color: active ? '#fff' : '#374151',
          fontWeight: 600,
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        {t(labelKey)}
      </button>
    );
  };

  return (
    <>
      <p
        style={{
          margin: '0 0 20px',
          fontSize: 14,
          color: '#374151',
          lineHeight: 1.55,
          textAlign: 'center',
        }}
      >
        {t('past_entry_page_intro')}
      </p>
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        {tabBtn('room', 'past_entry_tab_room')}
        {tabBtn('food', 'past_entry_tab_food')}
        {tabBtn('beer', 'past_entry_tab_beer')}
      </div>

      {tab === 'room' && <PastRoomCheckinForm staffNames={staffNames} />}
      {tab === 'food' && <PastFoodBeverageForm staffNames={staffNames} />}
      {tab === 'beer' && <PastBeerForm staffNames={staffNames} />}
    </>
  );
}
