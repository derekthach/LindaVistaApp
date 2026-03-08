'use client';

import type { UserRole } from '@/types';
import { LanguageProvider, LanguageToggle } from './LanguageToggle';

export default function AppContentWithLanguage({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const defaultLanguage = role === 'employee' ? 'es' : undefined;
  const showToggle = role === 'employee';

  return (
    <LanguageProvider defaultLanguage={defaultLanguage}>
      {showToggle && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: 16,
          }}
        >
          <LanguageToggle />
        </div>
      )}
      {children}
    </LanguageProvider>
  );
}
