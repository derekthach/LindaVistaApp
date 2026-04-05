'use client';

import { useEffect, useRef, useCallback, useTransition } from 'react';
import { logoutAction } from '@/app/actions/auth';

const IDLE_LIMIT_MS = 30 * 60 * 1000;
const WARN_MS = 25 * 60 * 1000;

/**
 * Client-side idle logout for employees (server still enforces on the next request).
 */
export default function InactivityGuard() {
  const [, startTransition] = useTransition();
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warned = useRef(false);

  const clearTimers = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (warnTimer.current) clearTimeout(warnTimer.current);
    idleTimer.current = null;
    warnTimer.current = null;
  }, []);

  const schedule = useCallback(() => {
    clearTimers();
    warned.current = false;

    warnTimer.current = setTimeout(() => {
      if (!warned.current) {
        warned.current = true;
        window.alert('Su sesión cerrará en unos minutos por inactividad. Mueva el mouse o pulse una tecla para seguir.');
      }
    }, WARN_MS);

    idleTimer.current = setTimeout(() => {
      startTransition(() => {
        void logoutAction();
      });
    }, IDLE_LIMIT_MS);
  }, [clearTimers, startTransition]);

  useEffect(() => {
    const bump = () => schedule();
    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, bump, { passive: true }));
    schedule();
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, bump));
      clearTimers();
    };
  }, [schedule, clearTimers]);

  return null;
}
