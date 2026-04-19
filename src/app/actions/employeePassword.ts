'use server';

import { redirect } from 'next/navigation';
import { getSession, requireAuth } from '@/server/auth/session';
import { hashPassword, updateJsonUserPassword } from '@/server/auth/users';
import { setUserPasswordAfterEmployeeChange } from '@/lib/server/usersRepo';

const MIN_LEN = 8;

export async function changeEmployeePasswordAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string } | void> {
  const session = await requireAuth(undefined, 'change-password');
  const pwd = String(formData.get('newPassword') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');
  if (pwd !== confirm) {
    return { error: 'Las contraseñas no coinciden.' };
  }
  if (pwd.length < MIN_LEN) {
    return { error: `La contraseña debe tener al menos ${MIN_LEN} caracteres.` };
  }
  const hash = await hashPassword(pwd);

  if (session.userId) {
    await setUserPasswordAfterEmployeeChange(session.userId, hash);
  } else if (session.mustChangePassword && session.role === 'employee') {
    try {
      updateJsonUserPassword(session.username, hash);
    } catch {
      return { error: 'Esta cuenta no admite cambio de contraseña aquí.' };
    }
  } else {
    return { error: 'Esta cuenta no admite cambio de contraseña aquí.' };
  }

  const s = await getSession();
  s.mustChangePassword = false;
  await s.save();

  redirect(session.role === 'admin' ? '/dashboard' : '/checkins/new');
}
