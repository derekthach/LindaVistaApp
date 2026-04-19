'use client';

import { useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { clearRoomCheckinSessionDraft } from '@/lib/checkins/roomDraft';

const CHECKIN_HOME = '/checkins/new';

/**
 * Subtle back control for room / food / beer check-in forms only.
 * Not used on review or confirmation screens (those use Cancel / existing actions).
 */
export default function CheckinFormBackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const busyRef = useRef(false);

  const handleClick = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    if (pathname?.includes('/checkins/new/room')) {
      clearRoomCheckinSessionDraft();
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(CHECKIN_HOME);
    }
    window.setTimeout(() => {
      busyRef.current = false;
    }, 400);
  }, [pathname, router]);

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        display: 'block',
        marginBottom: 12,
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontWeight: 700,
        fontSize: 15,
        color: '#374151',
        textAlign: 'left',
      }}
    >
      {t('back')}
    </button>
  );
}
