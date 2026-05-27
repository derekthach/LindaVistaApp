'use client';

import PastFoodBeerMultiRowForm from '@/components/admin/PastFoodBeerMultiRowForm';
import { submitPastFoodBeverageAction } from '@/app/actions/pastFoodBeverage';
import { ADMIN_LATE_FOOD_ITEMS } from '@/lib/checkins/items';

export default function PastFoodBeverageForm({ staffNames }: { staffNames: string[] }) {
  return (
    <PastFoodBeerMultiRowForm
      staffNames={staffNames}
      itemOptions={ADMIN_LATE_FOOD_ITEMS}
      checkInType="food"
      submitAction={submitPastFoodBeverageAction}
      introKey="past_entry_food_intro"
      savedKey="past_entry_food_saved"
      submitLabelKey="submit"
      reloadTabQuery="food"
    />
  );
}
