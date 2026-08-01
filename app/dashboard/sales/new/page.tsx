import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ButtonLink } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/guards";
import { getDashboardIdentity } from "@/lib/dashboard/identity";
import { shopContextFor } from "@/lib/shop/context";
import { listSellableProducts } from "@/lib/shop/queries";

import { SaleComposer } from "./sale-composer";

/**
 * New sale (SRS 8-11).
 *
 * Only products with stock on hand are offered, so the till cannot be loaded up
 * with a sale the database will refuse. That is a convenience, not the check:
 * `record_sale()` re-verifies availability against locked rows, which is what
 * makes two tills selling the last unit safe.
 */
export default async function NewSalePage() {
  const profile = await requireRole("OWNER", "ASSISTANT");
  const [{ displayName, displayEmail }, context] = await Promise.all([
    getDashboardIdentity(profile),
    shopContextFor(profile),
  ]);

  const products = await listSellableProducts(context);

  return (
    <>
      <DashboardHeader
        title="New sale"
        subtitle="Stock is deducted oldest batch first, so profit uses what you actually paid."
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
      />

      <div className="flex justify-end">
        <ButtonLink href="/dashboard/sales" variant="secondary">
          Sales history
        </ButtonLink>
      </div>

      <SaleComposer products={products} />
    </>
  );
}
