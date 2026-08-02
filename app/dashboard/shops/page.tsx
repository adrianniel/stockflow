import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Panel } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth/guards";
import { listShops } from "@/lib/admin/queries";
import { getDashboardIdentity } from "@/lib/dashboard/identity";

import { ShopManager } from "./shop-manager";

export const metadata = { title: "Shops" };

/**
 * Shop registry (SRS 5.1, 6.2). SUPER_ADMIN only.
 *
 * No shop context here: the platform administrator has no `shop_id`, and these
 * reads are meant to span every shop.
 */
export default async function ShopsPage() {
  const profile = await requireRole("SUPER_ADMIN");

  const [{ displayName, displayEmail }, shops] = await Promise.all([
    getDashboardIdentity(profile),
    listShops(),
  ]);

  return (
    <>
      <DashboardHeader
        title="Shops"
        subtitle="Register businesses and control their access."
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
      />

      <Panel>
        <ShopManager shops={shops} />
      </Panel>
    </>
  );
}
