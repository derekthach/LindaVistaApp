'use server';

import { redirect } from 'next/navigation';
import { getSession, requireAuth } from '@/server/auth/session';
import { hashPassword, updateJsonUserPassword } from '@/server/auth/users';
import type { UserRole } from '@/types';
import {
  docIdForUsername,
  firestoreUserDocExists,
  getUserDocByUsername,
  upsertEmployeePasswordAfterChange,
} from '@/lib/server/usersRepo';

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

  const usernameId = docIdForUsername(session.username);
  const firestoreUserId =
    session.userId && session.userId !== 'guest' ? session.userId.trim() : undefined;

  const docByUsername = await getUserDocByUsername(session.username);

  let targetFirestoreId: string | null = docByUsername?.id ?? null;
  if (!targetFirestoreId && firestoreUserId && (await firestoreUserDocExists(firestoreUserId))) {
    targetFirestoreId = firestoreUserId;
  }

  const profile = {
    fullName: (session.displayName ?? session.username).trim() || usernameId,
    role: (session.role === 'admin' ? 'admin' : 'employee') as UserRole,
  };

  if (targetFirestoreId) {
    try {
      await upsertEmployeePasswordAfterChange(targetFirestoreId, hash, profile, {
        allowCreateIfMissing: false,
      });
    } catch (err) {
      console.error('[change-password] Firestore update failed', err);
      return { error: GENERIC_SAVE_ERROR };
    }
  } else if (session.mustChangePassword) {
    /**
     * Local/dev: JSON file is writable. Production (e.g. Vercel): write throws — then create or
     * update Firestore `users/{username}` so the employee is not stuck after first login.
     */
    try {
      updateJsonUserPassword(session.username, hash);
    } catch (err) {
      console.error('[change-password] JSON persist failed; upserting Firestore user doc', err);
      try {
        await upsertEmployeePasswordAfterChange(usernameId, hash, profile, {
          allowCreateIfMissing: true,
        });
      } catch (err2) {
        console.error('[change-password] Firestore upsert failed', err2);
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
