'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/server/auth/session';
import { requireAdmin } from '@/lib/server/requireAdmin';
import { createPastFoodBeverageCheckin } from '@/lib/server/checkinsRepo';
import { getMergedCheckoutStaffDisplayNames } from '@/lib/server/checkoutStaffAllowlist';
import { validatePastFoodBeverageAdmin } from '@/lib/checkins/validation/pastFoodBeverage';

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
    item_id: formData.get('item_id'),
    item_label: formData.get('item_label'),
    quantity_sold: formData.get('quantity_sold'),
    amount_collected: formData.get('amount_collected'),
    payment_method: formData.get('payment_method'),
    notes: formData.get('notes'),
  };

  let staffAllowlist: string[];
  try {
    staffAllowlist = await getMergedCheckoutStaffDisplayNames();
  } catch {
    return { error: 'Could not load staff list. Try again.' };
  }

  const validation = validatePastFoodBeverageAdmin(raw, staffAllowlist);
  if (!validation.valid || !validation.item_id || validation.quantity_sold == null || validation.amount_collected == null) {
    const first =
      Object.values(validation.errors).find((m) => typeof m === 'string' && m.trim()) ??
      'Validation failed';
    return { error: first };
  }

  try {
    const id = await createPastFoodBeverageCheckin({
      date: validation.date!,
      time: validation.time!,
      staff_name: validation.staff_name!,
      item_id: validation.item_id,
      item_label: validation.item_label!,
      quantity_sold: validation.quantity_sold,
      amount_collected: validation.amount_collected,
      payment_method: validation.payment_method!,
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
