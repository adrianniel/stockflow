import Link from "next/link";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardMetricCard } from "@/components/dashboard/dashboard-metric-card";
import { ButtonLink } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth/guards";
import { getDashboardIdentity } from "@/lib/dashboard/identity";
import { shopContextFor } from "@/lib/shop/context";
import { listInventory, listSales } from "@/lib/shop/queries";
import { getDashboardSummary } from "@/lib/shop/reports";
import { LOW_STOCK_THRESHOLD } from "@/lib/shop/inventory-status";
import type { InventoryLine, SaleWithSeller } from "@/lib/shop/types";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
} from "@/lib/utils/format";

export const metadata = { title: "Dashboard" };

/**
 * Assistant home (SRS 5.3).
 *
 * The same shop figures the owner sees, minus the ownership controls. Profit is
 * included because SRS 5.3 grants report access, and an assistant quoting a
 * discount needs to know what the shop still earns on it.
 *
 * Sales are the shop's, not just this assistant's: the common question at the
 * counter is "has this already been rung up?", which only the shop-wide list can
 * answer.
 */
export default async function AssistantDashboard() {
  const profile = await requireRole("ASSISTANT");
  const [{ displayName, displayEmail }, context] = await Promise.all([
    getDashboardIdentity(profile),
    shopContextFor(profile),
  ]);

  const [summary, inventory, sales] = await Promise.all([
    getDashboardSummary(context),
    listInventory(context),
    listSales(context, { limit: 8 }),
  ]);

  const runningOut = inventory
    .filter((line) => line.quantityOnHand <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.quantityOnHand - b.quantityOnHand)
    .slice(0, 10);

  const stockColumns: Array<Column<InventoryLine>> = [
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
          <p className="text-xs text-slate-500">
            {line.brand ?? "No brand"}
            {line.categoryName ? ` · ${line.categoryName}` : ""}
          </p>
        </div>
      ),
    },
    {
      header: "On hand",
      align: "right",
      cell: (line) =>
        line.quantityOnHand === 0 ? (
          <span className="font-medium text-rose-600">Out of stock</span>
        ) : (
          <span className="font-medium text-amber-600">
            {formatNumber(line.quantityOnHand)} left
          </span>
        ),
    },
  ];

  const salesColumns: Array<Column<SaleWithSeller>> = [
    {
      header: "Sale",
      cell: (sale) => (
        <div>
          <Link
            href={`/dashboard/sales/${sale.id}`}
            className="font-medium text-slate-950 underline-offset-4 hover:underline"
          >
            {formatDateTime(sale.sale_date)}
          </Link>
          <p className="text-xs text-slate-500">
            {sale.item_count} line(s)
            {sale.seller_name ? ` · ${sale.seller_name}` : ""}
          </p>
        </div>
      ),
    },
    {
      header: "Total",
      align: "right",
      cell: (sale) => formatCurrency(sale.total_amount),
    },
  ];

  return (
    <>
      <DashboardHeader
        title="Daily operations"
        subtitle="Record sales and receive stock arrivals for your shop."
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
        shopName={profile.shop_name}
      />

      <section className="grid max-w-5xl grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <DashboardMetricCard
          label="Today's sales"
          value={formatCurrency(summary.today.totalSales)}
          detail={`${summary.today.saleCount} sale(s)`}
          graphic="sales"
        />
        <DashboardMetricCard
          label="Today's net profit"
          value={formatCurrency(summary.today.totalProfit)}
          detail={`${summary.today.itemCount} unit(s) sold`}
          graphic="profit"
        />
        <DashboardMetricCard
          label="Uncollected today"
          value={formatCurrency(summary.today.outstanding)}
          detail={
            summary.today.outstanding > 0 ? "Credit or partial" : "All settled"
          }
          graphic="credit"
        />
        <DashboardMetricCard
          label="Units on hand"
          value={formatNumber(summary.inventory.quantityOnHand)}
          detail={
            summary.inventory.outOfStockProducts > 0
              ? `${summary.inventory.outOfStockProducts} product(s) out`
              : "All stocked"
          }
          graphic="stock"
        />
      </section>

      <Panel>
        <PanelHeader
          title="Today"
          description="Start a sale, or log stock that just arrived from a supplier."
          actions={
            <>
              <ButtonLink href="/dashboard/sales/new">Record a sale</ButtonLink>
              <ButtonLink href="/dashboard/inventory" variant="secondary">
                Receive stock
              </ButtonLink>
            </>
          }
        />

        <DataTable
          rows={sales}
          columns={salesColumns}
          rowKey={(sale) => sale.id}
          emptyTitle="No sales yet"
          emptyDescription="Sales recorded in your shop appear here with their running total."
          emptyAction={
            <ButtonLink href="/dashboard/sales/new">Record a sale</ButtonLink>
          }
        />
      </Panel>

      <Panel>
        <PanelHeader
          title="Running low"
          description={`Products down to ${LOW_STOCK_THRESHOLD} units or fewer. Tell the owner before they sell out.`}
        />

        <DataTable
          rows={runningOut}
          columns={stockColumns}
          rowKey={(line) => line.productId}
          emptyTitle="Everything is stocked"
          emptyDescription="No product is down to its last few units."
        />
      </Panel>
    </>
  );
}
