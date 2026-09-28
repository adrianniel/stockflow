import { DashboardHeader } from "@/components/dashboard/dashboard-header";
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
          <InventoryStatusCard
            label="Units on hand"
            value={formatNumber(totalUnits)}
            detail={`${inventory.length} products`}
          />
          <InventoryStatusCard
            label="Stock value"
            value={formatCurrency(totalValue)}
            detail="At cost"
          />
          <InventoryStatusCard
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

function InventoryStatusCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "positive" | "warning";
}) {
  const valueColor =
    tone === "warning"
      ? "text-amber-700"
      : tone === "positive"
        ? "text-emerald-700"
        : "text-[#07152e]";

  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-2.5 shadow-[0_6px_20px_rgba(15,23,42,0.04)] sm:rounded-2xl sm:px-4 sm:py-3">
      <p className="truncate text-[0.58rem] font-semibold uppercase leading-4 tracking-[0.08em] text-slate-500 sm:text-xs sm:tracking-[0.12em]">
        {label}
      </p>
      <p title={value} className={`mt-1 truncate text-xs font-bold tracking-tight sm:text-lg ${valueColor}`}>
        {value}
      </p>
      <p className="mt-0.5 truncate text-[0.6rem] leading-4 text-slate-500 sm:text-xs">
        {detail}
      </p>
    </article>
  );
}
