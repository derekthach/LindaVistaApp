'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/server/auth/session';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { findUser, hashPassword, updateJsonUserAdminPasswordReset } from '@/server/auth/users';
import { getUserPublicById, updatePasswordAndFlags } from '@/lib/server/usersRepo';

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
    await updatePasswordAndFlags(userId, hash, {
      mustChangePassword: true,
      passwordResetRequested: false,
      passwordResetRequestedAt: null,
    });
  } else {
    const jsonUser = findUser(userId);
    if (!jsonUser || jsonUser.role !== 'employee') {
      return { error: 'User not found.' };
    }
    try {
      updateJsonUserAdminPasswordReset(jsonUser.username, hash);
    } catch (e) {
      console.error('[admin reset password] JSON user update failed', e);
      return { error: 'Could not update account.' };
    }
  }

  revalidatePath('/admin/employees');
  return { ok: true };
}
