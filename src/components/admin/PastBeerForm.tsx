'use client';

import PastFoodBeerMultiRowForm from '@/components/admin/PastFoodBeerMultiRowForm';
import { submitPastBeerAction } from '@/app/actions/pastBeer';
import { ADMIN_LATE_BEER_ITEMS } from '@/lib/checkins/items';

export default function PastBeerForm({ staffNames }: { staffNames: string[] }) {
  return (
    <PastFoodBeerMultiRowForm
      staffNames={staffNames}
      itemOptions={ADMIN_LATE_BEER_ITEMS}
      checkInType="beer"
      submitAction={submitPastBeerAction}
      introKey="past_entry_beer_intro"
      savedKey="past_entry_beer_saved"
      submitLabelKey="past_entry_beer_submit"
      reloadTabQuery="beer"
    />
  );
}
