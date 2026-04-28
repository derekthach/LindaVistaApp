import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import { initDbIfMissing } from '@/server/db/sqlite';
import PWARegister from '@/components/PWARegister';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export const metadata: Metadata = {
  title: 'Linda Vista HMS',
  description: 'Linda Vista Motel Management System',
  applicationName: 'Linda Vista HMS',
  icons: {
    icon: '/tmp_icon-192.png',
    apple: '/tmp_apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Linda Vista',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
};

initDbIfMissing();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/tmp_apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Linda Vista" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body suppressHydrationWarning>
        {children}
        <PWARegister />
        <Analytics />
      </body>
    </html>
  );
}
