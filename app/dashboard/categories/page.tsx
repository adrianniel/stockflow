import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Panel } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth/guards";
import { getDashboardIdentity } from "@/lib/dashboard/identity";
import { shopContextFor } from "@/lib/shop/context";
import { listCategoriesWithCounts } from "@/lib/shop/queries";

import { CategoryManager } from "./category-manager";

export const metadata = { title: "Categories" };

/**
 * Categories (SRS 6.3).
 *
 * OWNER only — the RLS policies for categories are owner-scoped for writes, and
 * the sidebar omits the link for assistants. requireRole() is what actually
 * enforces it.
 */
export default async function CategoriesPage() {
  const profile = await requireRole("OWNER");
  const [{ displayName, displayEmail }, context] = await Promise.all([
    getDashboardIdentity(profile),
    shopContextFor(profile),
  ]);

  const categories = await listCategoriesWithCounts(context);

  return (
    <>
      <DashboardHeader
        title="Categories"
        subtitle="Organise your catalogue into groups."
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
        shopName={profile.shop_name}
      />

      <Panel>
        <CategoryManager categories={categories} />
      </Panel>
    </>
  );
}
