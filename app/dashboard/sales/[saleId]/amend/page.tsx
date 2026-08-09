import { notFound } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ButtonLink } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth/guards";
import { getDashboardIdentity } from "@/lib/dashboard/identity";
import { shopContextFor } from "@/lib/shop/context";
import { amendSale } from "@/lib/shop/actions";
import {
  getReplacementSale,
  getSale,
  listCustomers,
  listInventory,
  listSaleItems,
} from "@/lib/shop/queries";
import type { CartLine } from "@/lib/shop/types";
import { formatCurrency, formatDateTime, toNumber } from "@/lib/utils/format";

import { SaleComposer } from "../../new/sale-composer";

export const metadata = { title: "Amend sale" };

export default async function AmendSalePage({
  params,
}: {
  params: Promise<{ saleId: string }>;
}) {
  const { saleId } = await params;
  const profile = await requireRole("OWNER");
  const [{ displayName, displayEmail }, context] = await Promise.all([
    getDashboardIdentity(profile),
    shopContextFor(profile),
  ]);

  const sale = await getSale(context, saleId);

  const replacement = sale ? await getReplacementSale(context, sale.id) : null;

  if (!sale) {
    notFound();
  }

  if (sale.voided_at || replacement) {
    return (
      <>
        <DashboardHeader
          title="Sale cannot be amended"
          subtitle="Only a live sale without a replacement can be amended."
          userName={displayName}
          userEmail={displayEmail}
          role={profile.role}
          shopName={profile.shop_name}
        />
        <Panel>
          <PanelHeader
            title={sale.voided_at ? "This sale is already voided" : "This sale is already replaced"}
            description={
              sale.voided_at
                ? "Voided sales remain in history and cannot be edited again."
                : "An original sale may only have one direct replacement."
            }
          />
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/dashboard/sales/${sale.id}`} variant="secondary">
              View sale
            </ButtonLink>
            {replacement ? (
              <ButtonLink href={`/dashboard/sales/${replacement.id}`}>
                View replacement
              </ButtonLink>
            ) : null}
          </div>
        </Panel>
      </>
    );
  }

  const [items, products, customers] = await Promise.all([
    listSaleItems(context, sale.id),
    listInventory(context, { includeEmptyBatches: true }),
    listCustomers(context),
  ]);

  const productMap = new Map(products.map((product) => [product.productId, product]));
  const lines: CartLine[] = [];
  const unresolved: string[] = [];

  for (const item of items) {
    const product = item.product_id ? productMap.get(item.product_id) : undefined;
    const batch = product?.batches.find((entry) => entry.id === item.stock_batch_id);

    if (!product || !batch || !item.stock_batch_id) {
      unresolved.push(item.product_name ?? "an item whose original batch is unavailable");
      continue;
    }

    const existing = lines.find((line) => line.stockBatchId === batch.id);
    const suggestedPrice = toNumber(item.batch_selling_price ?? item.suggested_price);
    const actualPrice =
      toNumber(item.actual_selling_price) === toNumber(item.suggested_price)
        ? null
        : toNumber(item.actual_selling_price);

    if (existing) {
      existing.quantity += item.quantity;
      existing.quantityAvailable += item.quantity;
      continue;
    }

    lines.push({
      productId: product.productId,
      productName: product.productName,
      stockBatchId: batch.id,
      batchNumber: batch.batchNumber,
      batchReceivedDate: batch.receivedDate,
      quantity: item.quantity,
      actualSellingPrice: actualPrice,
      suggestedPrice,
      quantityAvailable: batch.quantityRemaining + item.quantity,
    });
  }

  return (
    <>
      <DashboardHeader
        title="Amend sale"
        subtitle={`Original sale ${formatDateTime(sale.sale_date)} · ${formatCurrency(sale.total_amount)}`}
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
        shopName={profile.shop_name}
      />

      {unresolved.length > 0 ? (
        <Panel>
          <PanelHeader
            title="This sale cannot be prefilled safely"
            description="One or more original lines no longer has its product or batch record. Correct the inventory history first, then amend the sale."
          />
          <p className="text-sm text-rose-700">Unavailable: {unresolved.join(", ")}</p>
        </Panel>
      ) : (
        <SaleComposer
          products={products.filter((product) => product.quantityOnHand > 0 || product.batches.length > 0)}
          customers={customers}
          initialLines={lines}
          initialCustomerId={sale.customer_id ?? ""}
          initialPaymentStatus={sale.payment_status}
          initialAmountPaid={sale.amount_paid}
          action={amendSale}
          mode="amend"
          originalSaleId={sale.id}
        />
      )}
    </>
  );
}
