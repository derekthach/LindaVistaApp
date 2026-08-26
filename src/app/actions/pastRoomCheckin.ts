'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/server/auth/session';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { createPastRoomCheckin } from '@/lib/server/checkinsRepo';
import { getMergedCheckoutStaffDisplayNames } from '@/lib/server/checkoutStaffAllowlist';
import { validatePastRoomCheckinAdmin } from '@/lib/checkins/validation/pastRoomCheckin';

export async function submitPastRoomCheckinAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; ok?: boolean; id?: string }> {
  const session = await requireAuth('admin');
  await requireAdmin();

  const raw: Record<string, unknown> = {
    room_id: formData.get('room_id'),
    check_in_date: formData.get('check_in_date'),
    check_in_time: formData.get('check_in_time'),
    staff_name: formData.get('staff_name'),
    receipt_number: formData.get('receipt_number'),
    payment_splits: formData.get('payment_splits'),
    note: formData.get('note'),
    receipts_captured: formData.get('receipts_captured'),
  };

  let staffAllowlist: string[];
  try {
    staffAllowlist = await getMergedCheckoutStaffDisplayNames();
  } catch {
    return { error: 'Could not load staff list. Try again.' };
  }

  const validation = validatePastRoomCheckinAdmin(raw, staffAllowlist);
  if (!validation.valid || !validation.payment_splits || !validation.receipt_number) {
    const first =
      Object.values(validation.errors).find((m) => typeof m === 'string' && m.trim()) ??
      'Validation failed';
    return { error: first };
  }

  try {
    const id = await createPastRoomCheckin({
      room_id: validation.room_id!,
      check_in_date: validation.check_in_date!,
      check_in_time: validation.check_in_time!,
      staff_name: validation.staff_name!,
      receipt_number: validation.receipt_number,
      payment_splits: validation.payment_splits,
      note: typeof raw.note === 'string' ? raw.note : undefined,
      ...(validation.receipts_captured != null
        ? { receipts_captured: validation.receipts_captured }
        : {}),
      adminUsername: session.username?.trim() || 'admin',
      adminUserId: session.userId?.trim() || undefined,
    });
    revalidatePath('/checkins');
    revalidatePath('/dashboard');
    return { ok: true, id };
  } catch (e) {
    console.error('[submitPastRoomCheckinAction]', e);
    return { error: e instanceof Error ? e.message : 'Could not save check-in.' };
  }
}
