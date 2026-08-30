import { requireAuth } from '@/server/auth/session';
import AppLayout from '@/components/AppLayout';
import LocalizedPageHeading from '@/components/LocalizedPageHeading';
import PricingAdminClient from '@/components/admin/PricingAdminClient';
import { getFoodPricingMap } from '@/lib/server/foodPricingRepo';
import { getRoomPricingMap } from '@/lib/server/roomPricingRepo';

export const dynamic = 'force-dynamic';

export default async function AdminPricingPage() {
  const session = await requireAuth('admin');
  const [roomPrices, foodPrices] = await Promise.all([
    getRoomPricingMap(),
    getFoodPricingMap(),
  ]);

  return (
    <AppLayout
      role={session.role}
      employeeGreetingName={
        session.role === 'employee' ? (session.displayName ?? session.username) : undefined
      }
    >
      <div className="container">
        <LocalizedPageHeading titleKey="pricing_title" subtitleKey="pricing_subtitle" />
        <PricingAdminClient
          initialRoomPrices={roomPrices}
          initialFoodPrices={foodPrices}
        />
      </div>
    </AppLayout>
  );
}
