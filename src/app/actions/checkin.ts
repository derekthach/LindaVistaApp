'use server';

import { redirect } from 'next/navigation';
import { requireAuth } from '@/server/auth/session';
import { createCheckin } from '@/lib/server/checkinsRepo';
import type { CheckIn } from '@/types';

export async function submitCheckinAction(formData: FormData) {
  await requireAuth();

  const data: Omit<CheckIn, 'checkin_id'> = {
    room_id: parseInt(formData.get('room_id') as string),
    receipt_number: formData.get('receipt_number') as string,
    date: formData.get('date') as string,
    time: formData.get('time') as string,
    cost: parseFloat(formData.get('cost') as string),
    payment_method: formData.get('payment_method') as 'cash' | 'ath_mobil',
    staff_name: formData.get('staff_name') as string,
    car_plate: formData.get('car_plate') as string,
    car_make: formData.get('car_make') as string,
    car_color: formData.get('car_color') as string,
    note: (formData.get('note') as string) || undefined,
  };

  await createCheckin(data);
  redirect('/checkin');
}
