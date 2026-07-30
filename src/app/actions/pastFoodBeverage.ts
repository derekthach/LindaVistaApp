'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/server/auth/session';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { createPastFoodBeverageCheckin } from '@/lib/server/checkinsRepo';
import { getMergedCheckoutStaffDisplayNames } from '@/lib/server/checkoutStaffAllowlist';
import { validateAdminPastFoodBeerMulti } from '@/lib/checkins/validation/adminPastFoodBeerMulti';
import { ADMIN_LATE_FOOD_ITEMS } from '@/lib/checkins/items';

export async function submitPastFoodBeverageAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; ok?: boolean; id?: string }> {
  const session = await requireAuth('admin');
  await requireAdmin();

  const raw: Record<string, unknown> = {
    date: formData.get('date'),
    time: formData.get('time'),
    staff_name: formData.get('staff_name'),
    lineItems: formData.get('lineItems'),
    payment_splits: formData.get('payment_splits'),
    notes: formData.get('notes'),
  };

  let staffAllowlist: string[];
  try {
    staffAllowlist = await getMergedCheckoutStaffDisplayNames();
  } catch {
    return { error: 'Could not load staff list. Try again.' };
  }

  const validation = validateAdminPastFoodBeerMulti(raw, staffAllowlist, ADMIN_LATE_FOOD_ITEMS);
  if (!validation.valid || !validation.lineItems?.length || !validation.payment_splits?.length) {
    return { error: validation.error ?? 'Validation failed' };
  }

  try {
    const id = await createPastFoodBeverageCheckin({
      date: validation.date!,
      time: validation.time!,
      staff_name: validation.staff_name!,
      lineItems: validation.lineItems,
      payment_method: validation.payment_method!,
      payment_splits: validation.payment_splits,
      notes: validation.notes,
      adminUsername: session.username?.trim() || 'admin',
      adminUserId: session.userId?.trim() || undefined,
    });
    revalidatePath('/checkins');
    revalidatePath('/dashboard');
    return { ok: true, id };
  } catch (e) {
    console.error('[submitPastFoodBeverageAction]', e);
    return { error: e instanceof Error ? e.message : 'Could not save check-in.' };
  }
}
