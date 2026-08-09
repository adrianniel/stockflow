import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth/guards";
import { getDashboardIdentity } from "@/lib/dashboard/identity";
import { shopContextFor } from "@/lib/shop/context";
import {
  getDefaultInterest,
  listCategories,
  listInventory,
  listProducts,
} from "@/lib/shop/queries";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

import { InventoryBrowser } from "./inventory-browser";
import { ReceiveStockDialog } from "./receive-stock-dialog";

export const metadata = { title: "Inventory" };

/**
 * Inventory overview (SRS 6.4).
 *
 * Both shop roles reach this: assistants log arrivals and need to see what is
 * on hand (SRS 5.3). Editing a batch after the fact stays owner-only and lives
 * under Adjustments, so that a correction always carries a reason.
 */
export default async function InventoryPage() {
  const profile = await requireRole("OWNER", "ASSISTANT");
  const [{ displayName, displayEmail }, context] = await Promise.all([
    getDashboardIdentity(profile),
    shopContextFor(profile),
  ]);

  const [inventory, products, categories, defaultInterest] = await Promise.all([
    listInventory(context),
    listProducts(context),
    listCategories(context),
    getDefaultInterest(context),
  ]);

  const totalUnits = inventory.reduce(
    (total, line) => total + line.quantityOnHand,
    0,
  );
  const totalValue = inventory.reduce((total, line) => total + line.stockValue, 0);
  const outOfStock = inventory.filter((line) => line.quantityOnHand === 0).length;

  const productOptions = products.map((product) => ({
    id: product.id,
    label: product.brand
      ? `${product.product_name} — ${product.brand}`
      : product.product_name,
  }));

  return (
    <>
      <DashboardHeader
        title="Inventory"
        subtitle="What is on the shelf, and what it is worth."
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
        shopName={profile.shop_name}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Units on hand"
          value={formatNumber(totalUnits)}
          delta={`${inventory.length} product(s)`}
        />
        <StatCard
          label="Stock value"
          value={formatCurrency(totalValue)}
          delta="At capital price"
        />
        <StatCard
          label="Out of stock"
          value={formatNumber(outOfStock)}
          delta={outOfStock === 0 ? "All stocked" : "Needs reordering"}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Stock by product"
          description="Selling price shown is the oldest batch in stock — the one the next sale will draw from."
          actions={
            <ReceiveStockDialog
              products={productOptions}
              defaultInterest={defaultInterest}
            />
          }
        />

        <InventoryBrowser
          inventory={inventory}
          categories={categories.map((category) => category.name)}
        />
      </Panel>
    </>
  );
}
