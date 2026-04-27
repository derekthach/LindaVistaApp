import type { MetadataRoute } from 'next';

/** Web app manifest for installability (Add to Home Screen / install prompt). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Linda Vista HMS',
    short_name: 'Linda Vista',
    description: 'Motel check-in and management system',
    start_url: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f6f7fb',
    theme_color: '#166534',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
