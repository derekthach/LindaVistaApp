'use server';

import { redirect } from 'next/navigation';
import { getSession, requireAuth } from '@/server/auth/session';
import { hashPassword, updateJsonUserPassword } from '@/server/auth/users';
import { docIdForUsername, setUserPasswordAfterEmployeeChange } from '@/lib/server/usersRepo';

const MIN_LEN = 8;

const GENERIC_SAVE_ERROR =
  'No se pudo guardar la nueva contraseña. Si el problema continúa, contacte al administrador.';

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

  /** Firestore-backed login (`guest` marker is not a real user doc id). */
  const firestoreUserId =
    session.userId && session.userId !== 'guest' ? session.userId : undefined;

  if (firestoreUserId) {
    try {
      await setUserPasswordAfterEmployeeChange(firestoreUserId, hash);
    } catch (err) {
      console.error('[change-password] Firestore update failed', err);
      return { error: GENERIC_SAVE_ERROR };
    }
  /**
   * Legacy JSON login has no `userId`. Firestore-backed sessions use the first branch above.
   * Do not require `role === 'employee'` here: some Firestore docs omit/mis-store `role`, which
   * would leave `session.role` incorrect while `mustChangePassword` is still true after login.
   */
  } else if (session.mustChangePassword) {
    try {
      updateJsonUserPassword(session.username, hash);
    } catch (err) {
      console.error('[change-password] JSON file persist failed, trying Firestore by username id', err);
      try {
        await setUserPasswordAfterEmployeeChange(docIdForUsername(session.username), hash);
      } catch (err2) {
        console.error('[change-password] Firestore fallback failed', err2);
        return { error: GENERIC_SAVE_ERROR };
      }
    }
  } else {
    return { error: 'Esta cuenta no admite cambio de contraseña aquí.' };
  }

  const s = await getSession();
  s.mustChangePassword = false;
  await s.save();

  redirect(session.role === 'admin' ? '/dashboard' : '/checkins/new');
}
