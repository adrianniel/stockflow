import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth/guards";
import { getDashboardIdentity } from "@/lib/dashboard/identity";
import { shopContextFor } from "@/lib/shop/context";
import { getProfitReport, type SalesSummary } from "@/lib/shop/reports";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils/format";

export const metadata = { title: "Reports" };

/**
 * Sales and profit reports (SRS 12).
 *
 * Available to both shop roles — SRS 5.3 gives assistants report access.
 *
 * Every figure comes from recorded transactions rather than from current batch
 * prices, so a later price change cannot rewrite last week's profit.
 */
export default async function ReportsPage() {
  const profile = await requireRole("OWNER", "ASSISTANT");
  const [{ displayName, displayEmail }, context] = await Promise.all([
    getDashboardIdentity(profile),
    shopContextFor(profile),
  ]);

  const report = await getProfitReport(context);

  const dailyColumns: Array<Column<{ date: string; summary: SalesSummary }>> = [
    {
      header: "Date",
      cell: (row) => (
        <span className="font-medium text-slate-950">{formatDate(row.date)}</span>
      ),
    },
    {
      header: "Sales",
      align: "right",
      cell: (row) => formatNumber(row.summary.saleCount),
    },
    {
      header: "Units",
      align: "right",
      hideOnMobile: true,
      cell: (row) => formatNumber(row.summary.itemCount),
    },
    {
      header: "Revenue",
      align: "right",
      cell: (row) => formatCurrency(row.summary.totalSales),
    },
    {
      header: "Profit",
      align: "right",
      cell: (row) => <ProfitValue amount={row.summary.totalProfit} />,
    },
  ];

  const productColumns: Array<
    Column<{
      productName: string;
      quantitySold: number;
      revenue: number;
      profit: number;
    }>
  > = [
    {
      header: "Product",
      cell: (row) => (
        <span className="font-medium text-slate-950">{row.productName}</span>
      ),
    },
    {
      header: "Units sold",
      align: "right",
      cell: (row) => formatNumber(row.quantitySold),
    },
    {
      header: "Revenue",
      align: "right",
      hideOnMobile: true,
      cell: (row) => formatCurrency(row.revenue),
    },
    {
      header: "Profit",
      align: "right",
      cell: (row) => <ProfitValue amount={row.profit} />,
    },
  ];

  return (
    <>
      <DashboardHeader
        title="Reports"
        subtitle="Sales and profit over time, from actual transactions."
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
        shopName={profile.shop_name}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard label="Today" summary={report.today} />
        <SummaryCard label="Last 7 days" summary={report.last7Days} />
        <SummaryCard label="This month" summary={report.thisMonth} />
      </div>

      <Panel>
        <PanelHeader
          title="Daily breakdown"
          description="The last seven days, including days with no sales."
        />

        <DataTable
          rows={report.dailyBreakdown}
          columns={dailyColumns}
          rowKey={(row) => row.date}
          emptyTitle="No data yet"
          emptyDescription="Record a sale to start building your reports."
        />
      </Panel>

      <Panel>
        <PanelHeader
          title="Best sellers this month"
          description="Ranked by profit contribution, not by units sold — a cheap fast mover can earn less than one high-margin part."
        />

        <DataTable
          rows={report.topProducts}
          columns={productColumns}
          rowKey={(row) => row.productName}
          emptyTitle="No sales this month"
          emptyDescription="Product rankings appear once you have recorded sales this month."
        />
      </Panel>

      {report.thisMonth.outstanding > 0 ? (
        <Panel>
          <PanelHeader
            title="Uncollected this month"
            description="Sales recorded as credit or partial payment. This money is earned but not yet received."
          />

          <p className="text-2xl font-semibold tracking-tight text-amber-600">
            {formatCurrency(report.thisMonth.outstanding)}
          </p>
        </Panel>
      ) : null}
    </>
  );
}

function SummaryCard({
  label,
  summary,
}: {
  label: string;
  summary: SalesSummary;
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
      <p className="text-sm font-medium text-slate-500">{label}</p>

      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Revenue
        </p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          {formatCurrency(summary.totalSales)}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Profit</dt>
          <dd className="mt-1">
            <ProfitValue amount={summary.totalProfit} />
          </dd>
        </div>

        <div>
          <dt className="text-xs text-slate-500">Sales</dt>
          <dd className="mt-1 font-medium text-slate-950">
            {formatNumber(summary.saleCount)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function ProfitValue({ amount }: { amount: number }) {
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
