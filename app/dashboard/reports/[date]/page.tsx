import Link from "next/link";
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
import { parseDateKey } from "@/lib/shop/report-range";
import {
  getDayDetail,
  type DayCollection,
  type DaySale,
} from "@/lib/shop/reports";
import {
  formatCurrency,
  formatDateKey,
  formatNumber,
  formatTime,
} from "@/lib/utils/format";

/**
 * One day in full: what was sold, and what was collected.
 *
 * The two are reported side by side but never added together, because they
 * answer different questions. Revenue, cost and profit are accrual figures keyed
 * on when the sale was made — they are what the shop earned that day, and they
 * do not change when an old debt is settled later. Collections are cash keyed on
 * when the money arrived, which is what reconciles the drawer. A day can collect
 * more than it sold; the collections panel marks the rows that explain why.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  return { title: `Report — ${formatDateKey(date)}` };
}

export default async function DayDetailPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const profile = await requireRole("OWNER", "ASSISTANT");
  const [{ date }, { displayName, displayEmail }, context] = await Promise.all([
    params,
    getDashboardIdentity(profile),
    shopContextFor(profile),
  ]);

  // Rejected here as well as inside getDayDetail so a malformed URL is a 404
  // rather than an empty day that looks like a real one with no trade.
  if (!parseDateKey(date)) {
    notFound();
  }

  const detail = await getDayDetail(context, date);

  if (!detail) {
    notFound();
  }

  const saleColumns: Array<Column<DaySale>> = [
    {
      header: "Time",
      cell: (row) => (
        // Doubles as the row's link on phones, where the trailing View button
        // is hidden. The customer rides along underneath for the same reason —
        // its own column is gone at that width, and "who bought this" is the
        // one thing you cannot identify a row without.
        <div>
          <Link
            href={`/dashboard/sales/${row.id}`}
            className="block font-medium text-slate-950 hover:underline"
          >
            {formatTime(row.saleDate)}
            <span className="block text-xs font-normal text-slate-500 md:hidden">
              {row.customerName ?? "Walk-in"}
            </span>
          </Link>
          {row.replacesSaleId ? (
            <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.14em] text-amber-600">
              Replacement
            </span>
          ) : null}
        </div>
      ),
    },
    {
      header: "Customer",
      hideOnMobile: true,
      cell: (row) => row.customerName ?? "Walk-in",
    },
    {
      header: "Sold by",
      hideOnMobile: true,
      cell: (row) => row.sellerName ?? "—",
    },
    {
      header: "Units",
      align: "right",
      hideOnMobile: true,
      cell: (row) => formatNumber(row.itemCount),
    },
    {
      header: "Status",
      cell: (row) => (
        <Badge
          tone={
            row.paymentStatus === "PAID"
              ? "positive"
              : row.paymentStatus === "PARTIAL"
                ? "warning"
                : "danger"
          }
        >
          {row.paymentStatus}
        </Badge>
      ),
    },
    {
      header: "Revenue",
      align: "right",
      cell: (row) => formatCurrency(row.total),
    },
    {
      header: "Cost",
      align: "right",
      hideOnMobile: true,
      cell: (row) => formatCurrency(row.cost),
    },
    {
      header: "Profit",
      align: "right",
      cell: (row) => <ProfitValue amount={row.profit} />,
    },
    {
      header: "",
      align: "right",
      hideOnMobile: true,
      cell: (row) => (
        <ButtonLink href={`/dashboard/sales/${row.id}`} variant="ghost" size="sm">
          View
        </ButtonLink>
      ),
    },
  ];

  const collectionColumns: Array<Column<DayCollection>> = [
    {
      header: "Time",
      cell: (row) => (
        <Link
          href={`/dashboard/sales/${row.saleId}`}
          className="block font-medium text-slate-950 hover:underline"
        >
          {formatTime(row.collectedAt)}
        </Link>
      ),
    },
    {
      header: "Customer",
      cell: (row) => (
        <>
          {row.customerName ?? "—"}
          {/*
            The Against column is hidden on phones, but it carries the reason
            this panel exists — that a day can collect more than it sold. Losing
            it there would leave the number unexplained, so the marker repeats
            here at the width where the column is gone.
          */}
          {row.fromEarlierSale ? (
            <span className="mt-1 block text-xs font-medium text-amber-700 md:hidden">
              Earlier sale
            </span>
          ) : null}
        </>
      ),
    },
    {
      header: "Against",
      hideOnMobile: true,
      cell: (row) =>
        row.fromEarlierSale ? (
          <Badge tone="warning">Earlier sale</Badge>
        ) : (
          <span className="text-slate-500">Sale made today</span>
        ),
    },
    {
      header: "Received by",
      hideOnMobile: true,
      cell: (row) => row.collectedByName ?? "—",
    },
    {
      header: "Note",
      hideOnMobile: true,
      cell: (row) => row.note ?? "—",
    },
    {
      header: "Amount",
      align: "right",
      cell: (row) => (
        <span className="font-medium text-slate-950">
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      header: "",
      align: "right",
      hideOnMobile: true,
      cell: (row) => (
        <ButtonLink
          href={`/dashboard/sales/${row.saleId}`}
          variant="ghost"
          size="sm"
        >
          View sale
        </ButtonLink>
      ),
    },
  ];

  const collectedOnOlderSales = detail.collections
    .filter((collection) => collection.fromEarlierSale)
    .reduce((total, collection) => total + collection.amount, 0);

  return (
    <>
      <DashboardHeader
        title={formatDateKey(detail.date)}
        subtitle="Everything recorded on this day, split into sales made and cash received."
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
        shopName={profile.shop_name}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value={formatCurrency(detail.summary.totalSales)}
          delta={`${formatNumber(detail.summary.saleCount)} sale(s)`}
        />
        <StatCard
          label="Cost"
          value={formatCurrency(detail.summary.totalCost)}
          delta={`${formatNumber(detail.summary.itemCount)} unit(s)`}
        />
        <StatCard
          label="Profit"
          value={formatCurrency(detail.summary.totalProfit)}
          delta={
            detail.summary.totalProfit < 0 ? "Sold at a loss" : "Earned this day"
          }
        />
        <StatCard
          label="Collected"
          value={formatCurrency(detail.summary.totalCollected)}
          delta={
            collectedOnOlderSales > 0
              ? `${formatCurrency(collectedOnOlderSales)} on older sales`
              : "Cash received"
          }
        />
      </div>

      <Panel>
        <PanelHeader
          title="Sales made on this day"
          description="Revenue, cost and profit above come from these sales only. They are fixed once recorded — collecting an old debt does not change them."
          actions={
            <ButtonLink href="/dashboard/reports" variant="secondary">
              Back to reports
            </ButtonLink>
          }
        />

        <DataTable
          rows={detail.sales}
          columns={saleColumns}
          rowKey={(row) => row.id}
          emptyTitle="No sales on this day"
          emptyDescription="Nothing was sold on this date."
        />
      </Panel>

      <Panel>
        <PanelHeader
          title="Payments received on this day"
          description="Cash that came in, whenever the sale was made. Payments against older credit are marked, and are why a day's collections can exceed its sales."
        />

        <DataTable
          rows={detail.collections}
          columns={collectionColumns}
          rowKey={(row) => row.id}
          emptyTitle="No payments on this day"
          emptyDescription="No credit was collected on this date."
        />
      </Panel>

      {detail.summary.outstanding > 0 ? (
        <Panel>
          <PanelHeader
            title="Still owed from this day"
            description="Unpaid balance on the sales above, as of now. Collect on the Credit page."
          />

          <p className="text-2xl font-semibold tracking-tight text-amber-600">
            {formatCurrency(detail.summary.outstanding)}
          </p>
        </Panel>
      ) : null}
    </>
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
