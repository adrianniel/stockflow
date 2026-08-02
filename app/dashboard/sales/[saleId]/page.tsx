import { notFound } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth/guards";
import { getDashboardIdentity } from "@/lib/dashboard/identity";
import { shopContextFor } from "@/lib/shop/context";
import { getSale, listSaleItems } from "@/lib/shop/queries";
import type { SaleItem } from "@/lib/shop/types";
import { formatCurrency, formatDateTime, toNumber } from "@/lib/utils/format";

/**
 * One sale, line by line.
 *
 * A single product bought in a quantity that spanned two batches appears as two
 * rows, because that is how it is stored: one `sale_items` row per batch
 * consumed. That is what makes the profit auditable — each row carries the
 * capital price actually paid for those specific units.
 */
export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ saleId: string }>;
}) {
  const { saleId } = await params;
  const profile = await requireRole("OWNER", "ASSISTANT");
  const [{ displayName, displayEmail }, context] = await Promise.all([
    getDashboardIdentity(profile),
    shopContextFor(profile),
  ]);

  const sale = await getSale(context, saleId);

  if (!sale) {
    notFound();
  }

  const items = await listSaleItems(context, sale.id);

  const outstanding = toNumber(sale.total_amount) - toNumber(sale.amount_paid);

  const columns: Array<Column<SaleItem>> = [
    {
      header: "Product",
      cell: (item) => (
        <div>
          <p className="font-medium text-slate-950">
            {item.product_name ?? "Deleted product"}
          </p>
          <p className="text-xs text-slate-500">
            {item.batch_number ? `Batch ${item.batch_number}` : "Batch removed"}
          </p>
        </div>
      ),
    },
    {
      header: "Qty",
      align: "right",
      cell: (item) => item.quantity,
    },
    {
      header: "Capital",
      align: "right",
      hideOnMobile: true,
      cell: (item) => formatCurrency(item.capital_price),
    },
    {
      header: "Suggested",
      align: "right",
      hideOnMobile: true,
      cell: (item) => formatCurrency(item.suggested_price),
    },
    {
      header: "Charged",
      align: "right",
      cell: (item) => {
        const charged = toNumber(item.actual_selling_price);
        const suggested = toNumber(item.suggested_price);

        return (
          <div>
            <p className="font-medium text-slate-950">
              {formatCurrency(charged)}
            </p>
            {charged !== suggested ? (
              <p className="text-xs text-amber-600">
                {charged < suggested ? "Discounted" : "Above suggested"}
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      header: "Profit",
      align: "right",
      cell: (item) => {
        const profit = toNumber(item.profit);

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
        title="Sale details"
        subtitle={`${formatDateTime(sale.sale_date)}${
          sale.seller_name ? ` · recorded by ${sale.seller_name}` : ""
        }`}
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
        shopName={profile.shop_name}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total"
          value={formatCurrency(sale.total_amount)}
          delta={`${items.length} line(s)`}
        />
        <StatCard
          label="Profit"
          value={formatCurrency(sale.total_profit)}
          delta={
            toNumber(sale.total_profit) < 0 ? "Sold at a loss" : "Actual profit"
          }
        />
        <StatCard
          label="Collected"
          value={formatCurrency(sale.amount_paid)}
          delta={
            outstanding > 0 ? `${formatCurrency(outstanding)} due` : "Fully paid"
          }
        />
      </div>

      <Panel>
        <PanelHeader
          title="Items"
          description="One row per stock batch used. A quantity that spanned two batches is split across two rows."
          actions={
            <>
              <Badge>{sale.payment_status}</Badge>
              <ButtonLink href="/dashboard/sales" variant="secondary">
                Back to sales
              </ButtonLink>
            </>
          }
        />

        <DataTable
          rows={items}
          columns={columns}
          rowKey={(item) => item.id}
          emptyTitle="No line items"
          emptyDescription="This sale has no recorded items."
        />
      </Panel>
    </>
  );
}
