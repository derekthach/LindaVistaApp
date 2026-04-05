'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/server/auth/session';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { hashPassword } from '@/server/auth/users';
import { updatePasswordAndFlags } from '@/lib/server/usersRepo';

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
  await updatePasswordAndFlags(userId, hash, {
    mustChangePassword: true,
    passwordResetRequested: false,
    passwordResetRequestedAt: null,
  });

  revalidatePath('/admin/employees');
  return { ok: true };
}
