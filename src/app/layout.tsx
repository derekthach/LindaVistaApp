import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Linda Vista Motel - Management System',
  description: 'Motel check-in and management system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
