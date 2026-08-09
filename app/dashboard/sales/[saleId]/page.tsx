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
import {
  getReplacementSale,
  getSale,
  listSaleItems,
  listSalePayments,
} from "@/lib/shop/queries";
import type { SaleItem, SalePayment } from "@/lib/shop/types";
import {
  formatCurrency,
  formatDateKey,
  formatDateTime,
  toNumber,
} from "@/lib/utils/format";

import { VoidSaleDialog } from "./void-sale-dialog";

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

  const [items, payments, replacement] = await Promise.all([
    listSaleItems(context, sale.id),
    listSalePayments(context, sale.id),
    getReplacementSale(context, sale.id),
  ]);

  const voided = sale.voided_at !== null;
  const outstanding = toNumber(sale.total_amount) - toNumber(sale.amount_paid);

  // Only owners may void, and only a live sale can be voided. The action and
  // void_sale() both enforce the role independently — this just decides whether
  // the button is worth showing.
  const canVoid = profile.role === "OWNER" && !voided;
  const canAmend = profile.role === "OWNER" && !voided && !replacement;

  const paymentColumns: Array<Column<SalePayment>> = [
    {
      header: "Received",
      cell: (payment) => (
        <div>
          <p className="font-medium text-slate-950">
            {formatDateTime(payment.collected_at)}
          </p>
          <p className="text-xs text-slate-500">
            {payment.collected_by_name ?? "Unknown staff"}
            {Math.abs(new Date(payment.created_at).getTime() - new Date(payment.collected_at).getTime()) >= 60_000
              ? ` · entered ${formatDateTime(payment.created_at)}`
              : ""}
            {payment.note ? ` · ${payment.note}` : ""}
          </p>
        </div>
      ),
    },
    {
      header: "Amount",
      align: "right",
      cell: (payment) =>
        payment.voided_at ? (
          <div>
            <p className="font-medium text-slate-400 line-through">
              {formatCurrency(payment.amount)}
            </p>
            <p className="text-xs text-rose-600">Voided</p>
          </div>
        ) : (
          <span className="font-medium text-emerald-700">
            {formatCurrency(payment.amount)}
          </span>
        ),
    },
  ];

  const columns: Array<Column<SaleItem>> = [
    {
      header: "Product",
      cell: (item) => (
        <div>
          <p className="font-medium text-slate-950">
            {item.product_name ?? "Deleted product"}
          </p>
          <p className="text-xs text-slate-500">
            {item.batch_number
              ? `Ref ${item.batch_number} · received ${formatDateKey(
                  item.batch_received_date,
                )}`
              : "Batch removed"}
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

      {voided ? (
        <div
          role="status"
          className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800"
        >
          <p className="font-semibold uppercase tracking-[0.18em] text-rose-700">
            Voided sale
          </p>
          <p className="mt-2">{sale.void_reason}</p>
          <p className="mt-1 text-xs text-rose-700/80">
            Voided {formatDateTime(sale.voided_at)}
            {sale.voided_by_name ? ` by ${sale.voided_by_name}` : ""}. The stock
            has been returned to its batches and none of the figures below count
            towards any report.
          </p>
        </div>
      ) : null}

      {sale.replaces_sale_id ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          This sale replaces a previous recorded sale. The original remains in
          history and is excluded from financial reports.
          <div className="mt-2">
            <ButtonLink href={`/dashboard/sales/${sale.replaces_sale_id}`} variant="secondary">
              View original sale
            </ButtonLink>
          </div>
        </div>
      ) : null}

      {replacement ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          This sale has been amended. It remains in history but is excluded from
          financial reports.
          <div className="mt-2">
            <ButtonLink href={`/dashboard/sales/${replacement.id}`} variant="secondary">
              View replacement sale
            </ButtonLink>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total"
          value={formatCurrency(sale.total_amount)}
          delta={
            voided ? "Not counted — voided" : `${items.length} line(s)`
          }
        />
        <StatCard
          label="Profit"
          value={formatCurrency(sale.total_profit)}
          delta={
            voided
              ? "Not counted — voided"
              : toNumber(sale.total_profit) < 0
                ? "Sold at a loss"
                : "Actual profit"
          }
        />
        <StatCard
          label="Collected"
          value={formatCurrency(voided ? 0 : sale.amount_paid)}
          delta={
            // A voided sale owes nothing, so the outstanding figure would be
            // wrong here — its payments were voided with it, which is what
            // leaves amount_paid at zero.
            voided
              ? "Nothing owed — voided"
              : outstanding > 0
                ? `${formatCurrency(outstanding)} due`
                : "Fully paid"
          }
        />
      </div>

      <Panel>
        <PanelHeader
          title="Items"
          description="One row per stock batch used. A quantity that spanned two batches is split across two rows."
          actions={
            <>
              {voided ? (
                <Badge tone="danger">Voided</Badge>
              ) : (
                <Badge>{sale.payment_status}</Badge>
              )}
              {canVoid ? (
                <VoidSaleDialog
                  saleId={sale.id}
                  summary={`${formatCurrency(sale.total_amount)} recorded ${formatDateTime(
                    sale.sale_date,
                  )}`}
                />
              ) : null}
              {canAmend ? (
                <ButtonLink href={`/dashboard/sales/${sale.id}/amend`} variant="secondary">
                  Amend sale
                </ButtonLink>
              ) : null}
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

      {payments.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Payments"
            description={
              voided
                ? "Kept for history. These collections were voided with the sale and no longer count towards any day's takings."
                : "Every instalment collected against this sale, in the order the money arrived."
            }
          />

          <DataTable
            rows={payments}
            columns={paymentColumns}
            rowKey={(payment) => payment.id}
            emptyTitle="No payments"
            emptyDescription="Nothing has been collected against this sale."
          />
        </Panel>
      ) : null}
    </>
  );
}
