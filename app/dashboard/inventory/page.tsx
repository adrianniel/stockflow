import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { CompactStatCard } from "@/components/dashboard/compact-stat-card";
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
        subtitle="Receive stock and review what is currently on your shelves."
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
        shopName={profile.shop_name}
      />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-stretch sm:gap-4">
        <div className="grid min-w-0 grid-cols-3 gap-2 sm:gap-3">
          <CompactStatCard
            label="Units on hand"
            value={formatNumber(totalUnits)}
            detail={`${inventory.length} products`}
          />
          <CompactStatCard
            label="Stock value"
            value={formatCurrency(totalValue)}
            detail="At cost"
          />
          <CompactStatCard
            label="Out of stock"
            value={formatNumber(outOfStock)}
            detail={outOfStock === 0 ? "All stocked" : "Needs stock"}
            tone={outOfStock > 0 ? "warning" : "positive"}
          />
        </div>
        <ReceiveStockDialog
          products={productOptions}
          defaultInterest={defaultInterest}
          triggerLabel="Receive stock"
          triggerClassName="min-h-12 w-full px-5 py-3 text-sm font-semibold shadow-md shadow-blue-950/15 sm:h-full sm:w-auto sm:min-w-40"
        />
      </div>

      <Panel>
        <PanelHeader
          title="Stock by product"
          description="Search, filter, and review batch availability. Selling price is the oldest batch in stock—the one the next sale will draw from."
        />

        <InventoryBrowser
          inventory={inventory}
          categories={categories.map((category) => category.name)}
        />
      </Panel>
    </>
  );
}
