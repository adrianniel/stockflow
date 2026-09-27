import Link from "next/link";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatCard } from "@/components/dashboard/stat-card";
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
  toNumber,
} from "@/lib/utils/format";

export const metadata = { title: "Shop dashboard" };

/**
 * Owner home (SRS 12).
 *
 * Answers the three questions an owner opens the app for: what did we take
 * today, what did we earn on it, and what is about to run out. Everything below
 * the cards is a shortcut into the page that fixes the problem it names.
 */
export default async function OwnerDashboard() {
  const profile = await requireRole("OWNER");
  const [{ displayName, displayEmail }, context] = await Promise.all([
    getDashboardIdentity(profile),
    shopContextFor(profile),
  ]);

  const [summary, inventory, sales] = await Promise.all([
    getDashboardSummary(context),
    listInventory(context),
    listSales(context, { limit: 8 }),
  ]);

  // Out of stock first: those are lost sales already happening, while low stock
  // is only a warning. Within each group, the emptiest product leads.
  const needsAttention = inventory
    .filter((line) => line.quantityOnHand <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.quantityOnHand - b.quantityOnHand)
    .slice(0, 10);

  const attentionColumns: Array<Column<InventoryLine>> = [
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
    {
      header: "Profit",
      align: "right",
      hideOnMobile: true,
      cell: (sale) => {
        const profit = toNumber(sale.total_profit);

        return (
          <span
            className={
              profit < 0
                ? "font-medium text-rose-600"
                : "font-medium text-emerald-700"
            }
          >
            {formatCurrency(profit)}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <DashboardHeader
        title="Shop overview"
        subtitle="Inventory value, sales, and profit for your shop."
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
        shopName={profile.shop_name}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today's sales"
          value={formatCurrency(summary.today.totalSales)}
          delta={`${summary.today.saleCount} sale(s)`}
        />
        <StatCard
          label="Today's profit"
          value={formatCurrency(summary.today.totalProfit)}
          delta={`${summary.today.itemCount} unit(s) sold`}
        />
        <StatCard
          label="Stock value"
          value={formatCurrency(summary.inventory.stockValue)}
          delta={`${formatNumber(summary.inventory.quantityOnHand)} unit(s) on hand`}
        />
        <StatCard
          label="Products"
          value={formatNumber(summary.productCount)}
          delta={
            summary.inventory.outOfStockProducts > 0
              ? `${summary.inventory.outOfStockProducts} out of stock`
              : "All stocked"
          }
        />
      </section>

      {summary.today.outstanding > 0 ? (
        <Panel>
          <PanelHeader
            title="Uncollected today"
            description="Recorded as credit or partial payment. The profit is already counted, but the cash has not arrived."
            actions={
              <ButtonLink href="/dashboard/sales" variant="secondary">
                View sales
              </ButtonLink>
            }
          />

          <p className="text-3xl font-semibold tracking-tight text-amber-600">
            {formatCurrency(summary.today.outstanding)}
          </p>
        </Panel>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Needs restocking"
            description={`Products with ${LOW_STOCK_THRESHOLD} units or fewer left, emptiest first.`}
            actions={
              <ButtonLink href="/dashboard/inventory" variant="secondary">
                Receive stock
              </ButtonLink>
            }
          />

          <DataTable
            rows={needsAttention}
            columns={attentionColumns}
            rowKey={(line) => line.productId}
            emptyTitle="Everything is stocked"
            emptyDescription="No product is down to its last few units."
          />
        </Panel>

        <Panel>
          <PanelHeader
            title="Latest sales"
            description="The most recent transactions in your shop."
            actions={
              <ButtonLink href="/dashboard/sales/new">New sale</ButtonLink>
            }
          />

          <DataTable
            rows={sales}
            columns={salesColumns}
            rowKey={(sale) => sale.id}
            emptyTitle="No sales yet"
            emptyDescription="Add products, receive stock, then record your first sale."
            emptyAction={
              <ButtonLink href="/dashboard/products" variant="secondary">
                Go to products
              </ButtonLink>
            }
          />
        </Panel>
      </div>
    </>
  );
}
