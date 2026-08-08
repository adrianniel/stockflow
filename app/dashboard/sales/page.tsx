import Link from "next/link";
import type { ReactNode } from "react";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth/guards";
import { getDashboardIdentity } from "@/lib/dashboard/identity";
import { shopContextFor } from "@/lib/shop/context";
import { listSales } from "@/lib/shop/queries";
import { getDashboardSummary } from "@/lib/shop/reports";
import type { SaleWithSeller } from "@/lib/shop/types";
import { formatCurrency, formatDateTime, toNumber } from "@/lib/utils/format";

export const metadata = { title: "Sales" };

/**
 * Sales history (SRS 12).
 *
 * Both shop roles see the shop's sales, including each other's — an assistant
 * needs to answer "was this already rung up?", and RLS scopes reads to the shop
 * rather than to the individual seller.
 */
export default async function SalesPage() {
  const profile = await requireRole("OWNER", "ASSISTANT");
  const [{ displayName, displayEmail }, context] = await Promise.all([
    getDashboardIdentity(profile),
    shopContextFor(profile),
  ]);

  const [sales, summary] = await Promise.all([
    listSales(context),
    getDashboardSummary(context),
  ]);

  const columns: Array<Column<SaleWithSeller>> = [
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
          {/* Repeated here rather than left to the Status column, which is
              hidden on mobile — on a phone this is the only place the void
              would be visible, and a voided sale that reads as an ordinary one
              is worse than not listing it at all. */}
          {sale.voided_at ? (
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-rose-600">
              Voided
            </p>
          ) : null}
        </div>
      ),
    },
    {
      header: "Status",
      hideOnMobile: true,
      cell: (sale) =>
        sale.voided_at ? (
          <Badge tone="danger">Voided</Badge>
        ) : (
          <PaymentBadge sale={sale} />
        ),
    },
    {
      header: "Total",
      align: "right",
      cell: (sale) => <Cancellable sale={sale}>{formatCurrency(sale.total_amount)}</Cancellable>,
    },
    {
      header: "Profit",
      align: "right",
      cell: (sale) =>
        sale.voided_at ? (
          <Cancellable sale={sale}>{formatCurrency(sale.total_profit)}</Cancellable>
        ) : (
          <Profit value={sale.total_profit} />
        ),
    },
  ];

  return (
    <>
      <DashboardHeader
        title="Sales"
        subtitle="Every transaction recorded in your shop."
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
        shopName={profile.shop_name}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
          label="Uncollected today"
          value={formatCurrency(summary.today.outstanding)}
          delta={
            summary.today.outstanding > 0 ? "Credit or partial" : "All settled"
          }
        />
      </div>

      <Panel>
        <PanelHeader
          title="Recent sales"
          description="The 50 most recent transactions, voided ones included. Open one to see the batches it drew from."
          actions={<ButtonLink href="/dashboard/sales/new">New sale</ButtonLink>}
        />

        <DataTable
          rows={sales}
          columns={columns}
          rowKey={(sale) => sale.id}
          emptyTitle="No sales yet"
          emptyDescription="Record your first sale and it will appear here with its profit."
          emptyAction={<ButtonLink href="/dashboard/sales/new">New sale</ButtonLink>}
        />
      </Panel>
    </>
  );
}

function PaymentBadge({ sale }: { sale: SaleWithSeller }) {
  if (sale.payment_status === "PAID") {
    return <Badge>Paid</Badge>;
  }

  const outstanding = toNumber(sale.total_amount) - toNumber(sale.amount_paid);

  return (
    <div className="flex flex-col gap-1">
      <Badge>{sale.payment_status === "PARTIAL" ? "Partial" : "Credit"}</Badge>
      <span className="text-xs text-amber-600">
        {formatCurrency(outstanding)} due
      </span>
    </div>
  );
}

/**
 * A money figure that a void has cancelled.
 *
 * Struck through rather than blanked: the amount is still what was recorded,
 * and someone reconciling a day needs to see the number that used to be there
 * as well as the fact that it no longer counts.
 */
function Cancellable({
  sale,
  children,
}: {
  sale: SaleWithSeller;
  children: ReactNode;
}) {
  if (!sale.voided_at) {
    return <>{children}</>;
  }

  return <span className="text-slate-400 line-through">{children}</span>;
}

/**
 * Profit, negative when an item was discounted below capital price.
 *
 * Shown in red rather than hidden: a loss is a real outcome the shop chose, and
 * the report exists to surface it.
 */
function Profit({ value }: { value: string | number }) {
  const amount = toNumber(value);

  return (
    <span
      className={
        amount < 0 ? "font-medium text-rose-600" : "font-medium text-emerald-700"
      }
    >
      {formatCurrency(amount)}
    </span>
  );
}
