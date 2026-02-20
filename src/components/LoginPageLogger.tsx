'use client';

import { useEffect, useRef } from 'react';

const LOG_PREFIX = '[Linda Vista Login]';

export default function LoginPageLogger() {
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    console.log(LOG_PREFIX, 'Login page loaded');
    const form = document.querySelector<HTMLFormElement>('form[action="/api/auth/login"]');
    if (!form) return;
    formRef.current = form;
    const onSubmit = (e: Event) => {
      const target = e.target as HTMLFormElement;
      const username = (target.querySelector('input[name="username"]') as HTMLInputElement)?.value ?? '';
      console.log(LOG_PREFIX, 'Submitting login form', { username: username ? `${username.slice(0, 2)}***` : '(empty)' });
    };
    form.addEventListener('submit', onSubmit);
    return () => form.removeEventListener('submit', onSubmit);
  }, []);

  return null;
}
