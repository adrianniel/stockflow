import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth/guards";
import { getDashboardIdentity } from "@/lib/dashboard/identity";
import { shopContextFor } from "@/lib/shop/context";
import { listAdjustableBatches, listAdjustments } from "@/lib/shop/queries";
import type { StockAdjustment } from "@/lib/shop/types";
import { formatDateKey, formatDateTime } from "@/lib/utils/format";

import { AdjustStockDialog } from "./adjust-stock-dialog";

export const metadata = { title: "Stock adjustments" };

/**
 * Stock adjustments (SRS 13).
 *
 * OWNER only. An assistant miscounting stock should report it rather than
 * silently correct it, and the adjustment log is what makes shrinkage visible —
 * so the ability to write to it is the owner's.
 */
export default async function AdjustmentsPage() {
  const profile = await requireRole("OWNER");
  const [{ displayName, displayEmail }, context] = await Promise.all([
    getDashboardIdentity(profile),
    shopContextFor(profile),
  ]);

  const [adjustments, batches] = await Promise.all([
    listAdjustments(context),
    listAdjustableBatches(context),
  ]);

  const columns: Array<Column<StockAdjustment>> = [
    {
      header: "When",
      cell: (row) => formatDateTime(row.created_at),
    },
    {
      header: "Product",
      cell: (row) => (
        <div>
          <p className="font-medium text-slate-950">
            {row.product_name ?? "Deleted product"}
          </p>
          <p className="text-xs text-slate-500">
            {row.batch_number
              ? `Ref ${row.batch_number} · received ${formatDateKey(
                  row.batch_received_date,
                )}`
              : "Batch removed"}
          </p>
        </div>
      ),
    },
    {
      header: "Change",
      align: "right",
      cell: (row) => (
        <span
          className={
            row.quantity_change < 0
              ? "font-medium text-rose-600"
              : "font-medium text-emerald-700"
          }
        >
          {row.quantity_change > 0 ? "+" : ""}
          {row.quantity_change}
        </span>
      ),
    },
    {
      header: "Reason",
      hideOnMobile: true,
      cell: (row) => <span className="text-slate-600">{row.reason}</span>,
    },
    {
      header: "By",
      hideOnMobile: true,
      cell: (row) => row.adjusted_by_name ?? "—",
    },
  ];

  return (
    <>
      <DashboardHeader
        title="Stock adjustments"
        subtitle="Corrections for damaged, missing, or miscounted stock."
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
        shopName={profile.shop_name}
      />

      <Panel>
        <PanelHeader
          title="Adjustment history"
          description="Every correction is recorded with who made it and why. Adjustments cannot be edited or deleted."
          actions={<AdjustStockDialog batches={batches} />}
        />

        <DataTable
          rows={adjustments}
          columns={columns}
          rowKey={(row) => row.id}
          emptyTitle="No adjustments yet"
          emptyDescription="When stock is damaged or a count is wrong, record the correction here so the reason is kept."
        />
      </Panel>
    </>
  );
}
