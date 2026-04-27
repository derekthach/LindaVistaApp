'use client';

import { useEffect } from 'react';

/**
 * Registers a pass-through service worker in production builds only (including Vercel preview/prod).
 * Avoids interfering with Next.js dev / HMR. SW does not implement caching.
 */
export default function PWARegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/pwa-sw.js', { scope: '/' }).catch(() => {});
  }, []);
  return null;
}
