import Link from "next/link";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth/guards";
import { getDashboardIdentity } from "@/lib/dashboard/identity";
import { shopContextFor } from "@/lib/shop/context";
import {
  MAX_RANGE_DAYS,
  parseReportRange,
  type ReportSearchParams,
} from "@/lib/shop/report-range";
import { getProfitReport, type SalesSummary } from "@/lib/shop/reports";
import {
  formatCurrency,
  formatDateKey,
  formatNumber,
} from "@/lib/utils/format";

import { ReportFilters } from "./report-filters";

export const metadata = { title: "Reports" };

/**
 * Sales and profit reports (SRS 12).
 *
 * Available to both shop roles — SRS 5.3 gives assistants report access.
 *
 * Every figure comes from recorded transactions rather than from current batch
 * prices, so a later price change cannot rewrite last week's profit. The same
 * holds for collections: a debt settled today is today's cash and does not move
 * the profit already reported for the day the sale was made.
 *
 * The range lives in the URL, so a report is bookmarkable and shareable and the
 * back button walks through the ranges that were looked at.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<ReportSearchParams>;
}) {
  const profile = await requireRole("OWNER", "ASSISTANT");
  const [params, { displayName, displayEmail }, context] = await Promise.all([
    searchParams,
    getDashboardIdentity(profile),
    shopContextFor(profile),
  ]);

  const range = parseReportRange(params);
  const report = await getProfitReport(context, range);

  const dailyColumns: Array<Column<{ date: string; summary: SalesSummary }>> = [
    {
      header: "Date",
      cell: (row) => (
        <Link
          href={`/dashboard/reports/${row.date}`}
          className="font-medium text-slate-950 underline decoration-slate-300 underline-offset-4 transition hover:decoration-slate-900"
        >
          {formatDateKey(row.date)}
        </Link>
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
      header: "Cost",
      align: "right",
      hideOnMobile: true,
      cell: (row) => formatCurrency(row.summary.totalCost),
    },
    {
      header: "Collected",
      align: "right",
      hideOnMobile: true,
      cell: (row) => formatCurrency(row.summary.totalCollected),
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

  const rangeLabel =
    range.fromKey === range.toKey
      ? formatDateKey(range.fromKey)
      : `${formatDateKey(range.fromKey)} – ${formatDateKey(range.toKey)}`;

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

      <ReportFilters range={range} />

      {/* A shortened range is stated rather than quietly substituted. */}
      {range.requestedDays !== null ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You asked for {formatNumber(range.requestedDays)} days. Showing the
          most recent {MAX_RANGE_DAYS} instead, so the totals stay accurate.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label={rangeLabel} summary={report.total} highlight />
        <SummaryCard label="Today" summary={report.today} />
        <SummaryCard label="Last 7 days" summary={report.last7Days} />
        <SummaryCard label="This month" summary={report.thisMonth} />
      </div>

      <Panel>
        <PanelHeader
          title="Daily breakdown"
          description="Every day in the range, including days with no sales. Revenue and profit are what was sold that day; collected is the cash that came in — including payments on older credit. Tap a date for the full day."
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
          title="Best sellers"
          description="Ranked by profit contribution over this range, not by units sold — a cheap fast mover can earn less than one high-margin part."
        />

        <DataTable
          rows={report.topProducts}
          columns={productColumns}
          rowKey={(row) => row.productName}
          minWidth="md:min-w-[420px]"
          emptyTitle="No sales in this range"
          emptyDescription="Product rankings appear once you have recorded sales in the selected dates."
        />
      </Panel>

      {report.total.outstanding > 0 ? (
        <Panel>
          <PanelHeader
            title="Uncollected from this range"
            description="Still owed on sales recorded in these dates. This money is earned but not yet received, and falls as debts are collected."
          />

          <p className="text-2xl font-semibold tracking-tight text-amber-600">
            {formatCurrency(report.total.outstanding)}
          </p>
        </Panel>
      ) : null}
    </>
  );
}

function SummaryCard({
  label,
  summary,
  highlight = false,
}: {
  label: string;
  summary: SalesSummary;
  highlight?: boolean;
}) {
  return (
    <article
      className={
        highlight
          ? "rounded-3xl border border-slate-900 bg-slate-950 p-5 text-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]"
          : "rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur"
      }
    >
      <p
        className={
          highlight
            ? "text-sm font-medium text-slate-300"
            : "text-sm font-medium text-slate-500"
        }
      >
        {label}
      </p>

      <div className="mt-3">
        <p
          className={
            highlight
              ? "text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
              : "text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
          }
        >
          Revenue
        </p>
        <p
          className={
            highlight
              ? "mt-1 text-3xl font-semibold tracking-tight text-white"
              : "mt-1 text-3xl font-semibold tracking-tight text-slate-950"
          }
        >
          {formatCurrency(summary.totalSales)}
        </p>
      </div>

      <dl
        className={
          highlight
            ? "mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-4 text-sm"
            : "mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm"
        }
      >
        <Figure label="Cost" highlight={highlight}>
          {formatCurrency(summary.totalCost)}
        </Figure>

        <Figure label="Profit" highlight={highlight}>
          <ProfitValue amount={summary.totalProfit} onDark={highlight} />
        </Figure>

        <Figure label="Collected" highlight={highlight}>
          {formatCurrency(summary.totalCollected)}
        </Figure>

        <Figure label="Sales" highlight={highlight}>
          {formatNumber(summary.saleCount)}
        </Figure>
      </dl>
    </article>
  );
}

function Figure({
  label,
  highlight,
  children,
}: {
  label: string;
  highlight: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className={highlight ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
        {label}
      </dt>
      <dd
        className={
          highlight
            ? "mt-1 font-medium text-white"
            : "mt-1 font-medium text-slate-950"
        }
      >
        {children}
      </dd>
    </div>
  );
}

function ProfitValue({
  amount,
  onDark = false,
}: {
  amount: number;
  onDark?: boolean;
}) {
  // A loss is a real outcome — a discount below capital price — so it is shown
  // as one rather than clamped or hidden.
  const tone = amount < 0 ? "text-rose-500" : onDark ? "text-emerald-300" : "text-emerald-700";

  return <span className={`font-medium ${tone}`}>{formatCurrency(amount)}</span>;
}
