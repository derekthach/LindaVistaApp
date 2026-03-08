'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/LanguageToggle';

const OPTIONS = [
  { type: 'room' as const, slug: 'room', labelKey: 'room' as const },
  { type: 'food' as const, slug: 'food', labelKey: 'food_and_beverage' as const },
  { type: 'beer' as const, slug: 'beer', labelKey: 'beer' as const },
] as const;

export default function CheckInTypeSelector() {
  const { t } = useLanguage();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginTop: 8,
      }}
    >
      {OPTIONS.map(({ slug, labelKey }) => (
        <Link
          key={slug}
          href={`/checkins/new/${slug}`}
          style={{
            display: 'block',
            padding: 24,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            color: '#111827',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 18,
            textAlign: 'center',
            transition: 'background-color 0.15s ease, border-color 0.15s ease',
          }}
          className="card"
        >
          {t(labelKey)}
        </Link>
      ))}
    </div>
  );
}
