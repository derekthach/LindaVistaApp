import type { Metadata } from 'next';
import './globals.css';
import { initDbIfMissing } from '@/server/db/sqlite';

export const metadata: Metadata = {
  title: 'Linda Vista Motel - Management System',
  description: 'Motel check-in and management system',
  icons: { icon: '/logo1p.png' },
};

initDbIfMissing();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
