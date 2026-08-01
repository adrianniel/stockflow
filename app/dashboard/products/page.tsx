import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Panel } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth/guards";
import { getDashboardIdentity } from "@/lib/dashboard/identity";
import { shopContextFor } from "@/lib/shop/context";
import { listCategories, listInventory, listProducts } from "@/lib/shop/queries";

import { ProductManager } from "./product-manager";

/**
 * Product catalogue (SRS 6.3).
 *
 * Both shop roles can read it; only OWNER can change it, which is decided here
 * and passed down as `canManage`. That flag drives the UI only — the server
 * actions re-check the role, and RLS refuses an owner-only write regardless of
 * what the client sends.
 *
 * Products are the source of truth for the row; inventory is joined in only for
 * the quantity column, keyed by product id. Deriving the product list from
 * inventory instead would drop the description and force a fuzzy match on
 * category name, so an edit would silently blank fields it never showed.
 */
export default async function ProductsPage() {
  const profile = await requireRole("OWNER", "ASSISTANT");
  const [{ displayName, displayEmail }, context] = await Promise.all([
    getDashboardIdentity(profile),
    shopContextFor(profile),
  ]);

  const [catalogue, categories, inventory] = await Promise.all([
    listProducts(context),
    listCategories(context),
    listInventory(context),
  ]);

  const quantityByProduct = new Map(
    inventory.map((line) => [line.productId, line.quantityOnHand]),
  );

  const products = catalogue.map((product) => ({
    ...product,
    quantityOnHand: quantityByProduct.get(product.id) ?? 0,
  }));

  return (
    <>
      <DashboardHeader
        title="Products"
        subtitle="Everything your shop sells."
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
      />

      <Panel>
        <ProductManager
          products={products}
          categories={categories}
          canManage={profile.role === "OWNER"}
        />
      </Panel>
    </>
  );
}
