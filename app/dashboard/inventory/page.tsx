import Link from "next/link";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ButtonLink } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth/guards";
import { getDashboardIdentity } from "@/lib/dashboard/identity";
import { shopContextFor } from "@/lib/shop/context";
import { getDefaultInterest, listInventory, listProducts } from "@/lib/shop/queries";
import type { InventoryLine } from "@/lib/shop/types";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

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

  const [inventory, products, defaultInterest] = await Promise.all([
    listInventory(context),
    listProducts(context),
    getDefaultInterest(context),
  ]);

  const totalUnits = inventory.reduce(
    (total, line) => total + line.quantityOnHand,
    0,
  );
  const totalValue = inventory.reduce((total, line) => total + line.stockValue, 0);
  const outOfStock = inventory.filter((line) => line.quantityOnHand === 0).length;

  const columns: Array<Column<InventoryLine>> = [
    {
      header: "Product",
      cell: (line) => (
        <div>
          <Link
            href={`/dashboard/inventory/${line.productId}`}
            className="font-medium text-slate-950 underline-offset-4 hover:underline"
          >
            {line.productName}
          </Link>
          {line.brand ? (
            <p className="text-xs text-slate-500">{line.brand}</p>
          ) : null}
        </div>
      ),
    },
    {
      header: "Category",
      hideOnMobile: true,
      cell: (line) => line.categoryName ?? "—",
    },
    {
      header: "Batches",
      align: "right",
      hideOnMobile: true,
      cell: (line) => line.batchCount,
    },
    {
      header: "On hand",
      align: "right",
      cell: (line) => <StockLevel quantity={line.quantityOnHand} />,
    },
    {
      header: "Selling price",
      align: "right",
      hideOnMobile: true,
      cell: (line) =>
        line.currentSellingPrice === null
          ? "—"
          : formatCurrency(line.currentSellingPrice),
    },
    {
      header: "Stock value",
      align: "right",
      cell: (line) => formatCurrency(line.stockValue),
    },
  ];

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

        <DataTable
          rows={inventory}
          columns={columns}
          rowKey={(line) => line.productId}
          emptyTitle="No products yet"
          emptyDescription="Add a product first, then record its arrival to build up your inventory."
          emptyAction={
            <ButtonLink href="/dashboard/products" variant="secondary">
              Go to products
            </ButtonLink>
          }
        />
      </Panel>
    </>
  );
}

/** Colours the quantity so an empty or nearly-empty product is visible. */
function StockLevel({ quantity }: { quantity: number }) {
  if (quantity === 0) {
    return <span className="font-medium text-rose-600">Out of stock</span>;
  }

  if (quantity <= 5) {
    return <span className="font-medium text-amber-600">{quantity}</span>;
  }

  return <span className="font-medium text-slate-950">{quantity}</span>;
}
