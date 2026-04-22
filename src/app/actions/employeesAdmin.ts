'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/server/auth/session';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { findUser, hashPassword, updateJsonUserAdminPasswordReset } from '@/server/auth/users';
import {
  docIdForUsername,
  getUserPublicById,
  updatePasswordAndFlags,
  upsertEmployeeAdminPasswordReset,
} from '@/lib/server/usersRepo';

export async function adminResetEmployeePasswordAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  await requireAuth('admin');
  await requireAdmin();

  const userId = String(formData.get('userId') ?? '').trim();
  const newPassword = String(formData.get('newPassword') ?? '');
  if (!userId) {
    return { error: 'Missing user.' };
  }
  if (newPassword.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  const hash = await hashPassword(newPassword);
  const firestoreRow = await getUserPublicById(userId);
  if (firestoreRow) {
    try {
      await updatePasswordAndFlags(userId, hash, {
        mustChangePassword: true,
        passwordResetRequested: false,
        passwordResetRequestedAt: null,
      });
    } catch (e) {
      console.error('[admin reset password] Firestore update failed', e);
      return { error: 'Could not update account.' };
    }
  } else {
    const jsonUser = findUser(userId);
    if (!jsonUser || jsonUser.role !== 'employee') {
      return { error: 'User not found.' };
    }
    const fullName = (jsonUser.name?.trim() || jsonUser.username).trim();
    const usernameNorm = docIdForUsername(jsonUser.username);
    try {
      updateJsonUserAdminPasswordReset(jsonUser.username, hash);
    } catch (e) {
      console.warn('[admin reset password] JSON write failed (expected on read-only deploy); using Firestore', e);
      try {
        await upsertEmployeeAdminPasswordReset(usernameNorm, hash, {
          fullName,
          username: usernameNorm,
          role: 'employee',
        });
      } catch (e2) {
        console.error('[admin reset password] Firestore upsert failed', e2);
        return { error: 'Could not update account.' };
      }
    }
  }

  revalidatePath('/admin/employees');
  return { ok: true };
}
