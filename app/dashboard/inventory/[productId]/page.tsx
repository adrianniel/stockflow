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
  getDefaultInterest,
  getProduct,
  listBatchesForProduct,
} from "@/lib/shop/queries";
import type { StockBatch } from "@/lib/shop/types";
import {
  formatCurrency,
  formatDateKey,
  formatNumber,
  formatPercent,
  toNumber,
} from "@/lib/utils/format";

import { ReceiveStockDialog } from "../receive-stock-dialog";

/**
 * One product's stock batches (SRS 7, rules 1-3).
 *
 * This is where batch inventory becomes visible: the same product listed once
 * per arrival, each row keeping the capital price, markup and selling price it
 * was received at. Rows are in FIFO order, so the topmost batch with stock is
 * the one the next sale will draw from.
 */
export default async function ProductInventoryPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const profile = await requireRole("OWNER", "ASSISTANT");
  const [{ displayName, displayEmail }, context] = await Promise.all([
    getDashboardIdentity(profile),
    shopContextFor(profile),
  ]);

  const product = await getProduct(context, productId);

  // getProduct filters on shop_id, so another shop's product id is
  // indistinguishable from one that does not exist. That is deliberate: a
  // different response would confirm the id is real.
  if (!product) {
    notFound();
  }

  const [batches, defaultInterest] = await Promise.all([
    listBatchesForProduct(context, productId),
    getDefaultInterest(context),
  ]);

  const inStock = batches.filter((batch) => batch.quantity_remaining > 0);
  const quantityOnHand = inStock.reduce(
    (total, batch) => total + batch.quantity_remaining,
    0,
  );
  const stockValue = inStock.reduce(
    (total, batch) =>
      total + batch.quantity_remaining * toNumber(batch.capital_price),
    0,
  );

  // The batch a sale would consume first — what the till will suggest.
  const nextBatch = inStock[0] ?? null;

  const columns: Array<Column<StockBatch>> = [
    {
      header: "Reference",
      cell: (batch) => (
        <div className="flex items-center gap-2">
          <div>
            <span className="font-medium text-slate-950">
              {batch.batch_number}
            </span>
            {/*
             * References are free-form and may repeat across arrivals, so the
             * date rides along here — the Received column is hidden on mobile,
             * where this would otherwise be the only thing shown.
             */}
            <span className="block text-xs text-slate-500 md:hidden">
              {formatDateKey(batch.received_date)}
            </span>
          </div>
          {batch.quantity_remaining === 0 ? (
            <Badge tone="neutral">Sold out</Badge>
          ) : nextBatch?.id === batch.id ? (
            <Badge tone="positive">Next out</Badge>
          ) : null}
        </div>
      ),
    },
    {
      header: "Received",
      hideOnMobile: true,
      cell: (batch) => formatDateKey(batch.received_date),
    },
    {
      header: "Capital",
      align: "right",
      cell: (batch) => formatCurrency(batch.capital_price),
    },
    {
      header: "Interest",
      align: "right",
      hideOnMobile: true,
      cell: (batch) => formatPercent(batch.interest_percentage),
    },
    {
      header: "Selling",
      align: "right",
      cell: (batch) => formatCurrency(batch.selling_price),
    },
    {
      header: "Remaining",
      align: "right",
      cell: (batch) => (
        <span
          className={
            batch.quantity_remaining === 0
              ? "text-slate-400"
              : "font-medium text-slate-950"
          }
        >
          {formatNumber(batch.quantity_remaining)} /{" "}
          {formatNumber(batch.quantity_received)}
        </span>
      ),
    },
  ];

  return (
    <>
      <DashboardHeader
        title={product.product_name}
        subtitle={
          [product.brand, product.category_name].filter(Boolean).join(" · ") ||
          "Stock batches for this product."
        }
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
        shopName={profile.shop_name}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="On hand"
          value={formatNumber(quantityOnHand)}
          delta={`${inStock.length} batch(es) in stock`}
        />
        <StatCard
          label="Stock value"
          value={formatCurrency(stockValue)}
          delta="At capital price"
        />
        <StatCard
          label="Next selling price"
          value={
            nextBatch ? formatCurrency(nextBatch.selling_price) : "—"
          }
          delta={
            nextBatch
              ? `Ref ${nextBatch.batch_number} · ${formatDateKey(
                  nextBatch.received_date,
                )}`
              : "No stock"
          }
        />
      </div>

      {product.description ? (
        <Panel>
          <PanelHeader title="Description" />
          <p className="text-sm text-slate-600">{product.description}</p>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader
          title="Stock batches"
          description="Oldest first. Prices are never rewritten — a new arrival at a different price becomes a new batch."
          actions={
            <>
              <ReceiveStockDialog
                products={[{ id: product.id, label: product.product_name }]}
                defaultInterest={defaultInterest}
                fixedProductId={product.id}
              />
              <ButtonLink href="/dashboard/inventory" variant="secondary">
                All inventory
              </ButtonLink>
            </>
          }
        />

        <DataTable
          rows={batches}
          columns={columns}
          rowKey={(batch) => batch.id}
          emptyTitle="No stock arrivals yet"
          emptyDescription="Record this product's first arrival to give it a price and quantity."
        />
      </Panel>
    </>
  );
}
