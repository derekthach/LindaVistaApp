'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/server/auth/session';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { findUser, hashPassword, updateJsonUserAdminPasswordReset } from '@/server/auth/users';
import {
  createEmployeeUserDoc,
  docIdForUsername,
  firestoreUserDocExists,
  getUserPublicById,
  isReservedEmployeeUsername,
  type UserStatus,
  updatePasswordAndFlags,
  upsertEmployeeAdminPasswordReset,
  updateEmployeeProfileAdmin,
  softDeleteEmployeeFromAdminList,
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

const TEMP_NEW_EMPLOYEE_PASSWORD = '123123123';

export async function adminAddEmployeeAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  await requireAuth('admin');
  await requireAdmin();

  const fullName = String(formData.get('fullName') ?? '').trim();
  const usernameRaw = String(formData.get('username') ?? '').trim();
  const statusRaw = String(formData.get('status') ?? 'active').trim().toLowerCase();
  const status: UserStatus = statusRaw === 'inactive' ? 'inactive' : 'active';

  if (!fullName) {
    return { error: 'Full name is required.' };
  }
  if (!usernameRaw) {
    return { error: 'Username is required.' };
  }
  if (usernameRaw !== usernameRaw.toLowerCase()) {
    return { error: 'Username must be all lowercase.' };
  }
  if (isReservedEmployeeUsername(usernameRaw)) {
    return { error: 'That username is reserved.' };
  }

  const id = docIdForUsername(usernameRaw);
  if (await firestoreUserDocExists(id)) {
    return { error: 'An account with that username already exists.' };
  }
  if (findUser(usernameRaw)) {
    return { error: 'An account with that username already exists.' };
  }

  const passwordHash = await hashPassword(TEMP_NEW_EMPLOYEE_PASSWORD);
  try {
    await createEmployeeUserDoc({
      fullName,
      username: usernameRaw,
      status,
      passwordHash,
    });
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === 'DUPLICATE_USERNAME') {
        return { error: 'An account with that username already exists.' };
      }
      if (e.message === 'RESERVED_USERNAME') {
        return { error: 'That username is reserved.' };
      }
    }
    console.error('[admin add employee]', e);
    return { error: 'Could not create employee. Try again.' };
  }

  revalidatePath('/admin/employees');
  return { ok: true };
}

export async function adminSaveEmployeesBulkAction(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  await requireAuth('admin');
  await requireAdmin();

  const raw = String(formData.get('updates') ?? '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: 'Invalid data.' };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { error: 'Nothing to save.' };
  }
  if (parsed.length > 200) {
    return { error: 'Too many rows.' };
  }

  for (const item of parsed) {
    if (!item || typeof item !== 'object') {
      return { error: 'Invalid row.' };
    }
    const row = item as { id?: string; fullName?: string; status?: string };
    const id = String(row.id ?? '').trim();
    const fullName = String(row.fullName ?? '');
    const status = String(row.status ?? '').trim().toLowerCase();
    if (!id) {
      return { error: 'Missing user id.' };
    }
    if (status !== 'active' && status !== 'inactive') {
      return { error: 'Invalid status.' };
    }

    const existing = await getUserPublicById(id);
    if (!existing) {
      return {
        error:
          'One or more accounts are not stored in the database and cannot be edited here. Contact your developer for legacy JSON-only users.',
      };
    }
    if (existing.role !== 'employee') {
      return { error: 'You can only edit employee accounts.' };
    }
    if (existing.hiddenFromEmployeeList === true) {
      return { error: 'Cannot update an account that was removed from the list.' };
    }

    try {
      await updateEmployeeProfileAdmin(id, {
        fullName,
        status: status as UserStatus,
      });
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      if (code === 'NOT_FOUND') {
        return { error: 'User not found.' };
      }
      if (code === 'NOT_EMPLOYEE') {
        return { error: 'You can only edit employee accounts.' };
      }
      if (code === 'EMPTY_NAME') {
        return { error: 'Full name cannot be empty.' };
      }
      console.error('[admin save employees]', e);
      return { error: 'Could not save changes.' };
    }
  }

  revalidatePath('/admin/employees');
  return { ok: true };
}

export async function adminSoftDeleteEmployeeAction(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  await requireAuth('admin');
  await requireAdmin();

  const userId = String(formData.get('userId') ?? '').trim();
  if (!userId) {
    return { error: 'Missing user.' };
  }

  const existing = await getUserPublicById(userId);
  if (!existing) {
    return { error: 'User not found.' };
  }
  if (existing.role !== 'employee') {
    return { error: 'Forbidden.' };
  }

  try {
    await softDeleteEmployeeFromAdminList(userId);
  } catch (e) {
    const code = e instanceof Error ? e.message : '';
    if (code === 'GUEST') {
      return { error: 'The shared guest account cannot be removed from the list.' };
    }
    if (code === 'NOT_FOUND' || code === 'NOT_EMPLOYEE') {
      return { error: 'User not found.' };
    }
    console.error('[admin soft-delete employee]', e);
    return { error: 'Could not remove employee. Try again.' };
  }

  revalidatePath('/admin/employees');
  return { ok: true };
}
