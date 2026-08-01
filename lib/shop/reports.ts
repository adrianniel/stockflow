import { toNumber } from "@/lib/utils/format";

import type { ShopContext } from "./context";
import type { PaymentStatus } from "./types";

/**
 * Aggregates for the dashboards and the reports page (SRS 12).
 *
 * Date handling is the subtle part. `sales.sale_date` is `timestamptz`, and the
 * boundaries of "today" belong to the shop's own day, not to UTC — a sale at
 * 8am in Manila is 00:00 UTC, so a UTC-based day boundary would file the
 * morning's takings under yesterday. The ranges below are therefore built from
 * the server's local date parts and sent as ISO instants, so a shop that
 * deploys with its own timezone gets its own day.
 *
 * Profit may be negative: a discount below capital price is a real loss and is
 * reported as one rather than clamped.
 */

export type SalesSummary = {
  saleCount: number;
  itemCount: number;
  totalSales: number;
  totalProfit: number;
  totalCollected: number;
  /** Unpaid balance across CREDIT and PARTIAL sales in the range. */
  outstanding: number;
};

export type DashboardSummary = {
  today: SalesSummary;
  productCount: number;
  inventory: {
    quantityOnHand: number;
    stockValue: number;
    outOfStockProducts: number;
    lowStockProducts: number;
  };
};

export type ProfitReport = {
  today: SalesSummary;
  last7Days: SalesSummary;
  thisMonth: SalesSummary;
  /** Newest first, for the daily breakdown table. */
  dailyBreakdown: Array<{ date: string; summary: SalesSummary }>;
  topProducts: Array<{
    productName: string;
    quantitySold: number;
    revenue: number;
    profit: number;
  }>;
};

/** A product at or below this many units is flagged as low stock. */
const LOW_STOCK_THRESHOLD = 5;

const EMPTY_SUMMARY: SalesSummary = {
  saleCount: 0,
  itemCount: 0,
  totalSales: 0,
  totalProfit: 0,
  totalCollected: 0,
  outstanding: 0,
};

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);

  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);

  return copy;
}

/** Local calendar date as YYYY-MM-DD, used to bucket sales by day. */
function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

type SaleAggregateRow = {
  id: string;
  total_amount: string;
  total_profit: string;
  amount_paid: string;
  payment_status: PaymentStatus;
  sale_date: string | null;
  sale_items: Array<{ quantity: number }> | null;
};

/**
 * Loads sales in a half-open range [from, to).
 *
 * Half-open so that consecutive ranges neither overlap nor leave a gap: a sale
 * at exactly midnight belongs to the day starting then, once.
 */
async function loadSales(
  { supabase, shopId }: ShopContext,
  from: Date,
  to: Date,
): Promise<SaleAggregateRow[]> {
  const { data, error } = await supabase
    .from("sales")
    .select(
      `
      id,
      total_amount,
      total_profit,
      amount_paid,
      payment_status,
      sale_date,
      sale_items ( quantity )
    `,
    )
    .eq("shop_id", shopId)
    .gte("sale_date", from.toISOString())
    .lt("sale_date", to.toISOString())
    .order("sale_date", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as SaleAggregateRow[];
}

function summarize(rows: SaleAggregateRow[]): SalesSummary {
  return rows.reduce<SalesSummary>((summary, row) => {
    const total = toNumber(row.total_amount);
    const paid = toNumber(row.amount_paid);

    return {
      saleCount: summary.saleCount + 1,
      itemCount:
        summary.itemCount +
        (row.sale_items ?? []).reduce((sum, item) => sum + item.quantity, 0),
      totalSales: summary.totalSales + total,
      totalProfit: summary.totalProfit + toNumber(row.total_profit),
      totalCollected: summary.totalCollected + paid,
      outstanding: summary.outstanding + (total - paid),
    };
  }, { ...EMPTY_SUMMARY });
}

/**
 * Metrics for the owner and assistant dashboard cards.
 *
 * One pass over today's sales plus one over the batch table, rather than a
 * count query per card, so the whole dashboard costs two round trips.
 */
export async function getDashboardSummary(
  context: ShopContext,
): Promise<DashboardSummary> {
  const { supabase, shopId } = context;
  const todayStart = startOfDay(new Date());

  const [todaySales, productsResult, batchesResult] = await Promise.all([
    loadSales(context, todayStart, addDays(todayStart, 1)),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId),
    supabase
      .from("stock_batches")
      .select("product_id, quantity_remaining, capital_price")
      .eq("shop_id", shopId),
  ]);

  if (productsResult.error) {
    throw productsResult.error;
  }

  if (batchesResult.error) {
    throw batchesResult.error;
  }

  const batches = (batchesResult.data ?? []) as Array<{
    product_id: string;
    quantity_remaining: number;
    capital_price: string;
  }>;

  let quantityOnHand = 0;
  let stockValue = 0;
  const perProduct = new Map<string, number>();

  for (const batch of batches) {
    quantityOnHand += batch.quantity_remaining;
    stockValue += batch.quantity_remaining * toNumber(batch.capital_price);

    perProduct.set(
      batch.product_id,
      (perProduct.get(batch.product_id) ?? 0) + batch.quantity_remaining,
    );
  }

  const productCount = productsResult.count ?? 0;

  // A product with no batch row at all has no entry in the map, so counting
  // zero-quantity entries would miss it. Derive from the product total instead.
  const productsWithStock = [...perProduct.values()].filter(
    (quantity) => quantity > 0,
  ).length;

  const lowStockProducts = [...perProduct.values()].filter(
    (quantity) => quantity > 0 && quantity <= LOW_STOCK_THRESHOLD,
  ).length;

  return {
    today: summarize(todaySales),
    productCount,
    inventory: {
      quantityOnHand,
      stockValue,
      outOfStockProducts: Math.max(productCount - productsWithStock, 0),
      lowStockProducts,
    },
  };
}

/**
 * Daily, weekly and monthly figures plus a per-day breakdown (SRS 12).
 *
 * Fetches the widest range once and derives the narrower ones in memory, so the
 * three headline numbers and the table cost a single query.
 */
export async function getProfitReport(
  context: ShopContext,
): Promise<ProfitReport> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);

  // "Last 7 days" includes today, so it starts 6 days back.
  const weekStart = addDays(todayStart, -6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Whichever boundary reaches furthest back covers all three ranges.
  const rangeStart = weekStart < monthStart ? weekStart : monthStart;

  const rows = await loadSales(context, rangeStart, tomorrowStart);

  const inRange = (row: SaleAggregateRow, from: Date) =>
    row.sale_date !== null && new Date(row.sale_date) >= from;

  const byDay = new Map<string, SaleAggregateRow[]>();

  for (const row of rows) {
    if (!row.sale_date) {
      continue;
    }

    const key = localDateKey(new Date(row.sale_date));
    const bucket = byDay.get(key);

    if (bucket) {
      bucket.push(row);
    } else {
      byDay.set(key, [row]);
    }
  }

  // Every day in the last 7 gets a row, including days with no sales — a gap in
  // the table reads as missing data rather than as a quiet day.
  const dailyBreakdown = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(todayStart, -index);
    const key = localDateKey(date);

    return { date: key, summary: summarize(byDay.get(key) ?? []) };
  });

  return {
    today: summarize(rows.filter((row) => inRange(row, todayStart))),
    last7Days: summarize(rows.filter((row) => inRange(row, weekStart))),
    thisMonth: summarize(rows.filter((row) => inRange(row, monthStart))),
    dailyBreakdown,
    topProducts: await getTopProducts(context, monthStart, tomorrowStart),
  };
}

type TopProductRow = {
  quantity: number;
  actual_selling_price: string;
  profit: string;
  stock_batches: {
    products: { product_name: string } | { product_name: string }[] | null;
  } | Array<{
    products: { product_name: string } | { product_name: string }[] | null;
  }> | null;
};

/**
 * Best sellers for the month, ranked by profit contribution.
 *
 * Reached through `sale_items` rather than `sales` because quantity and profit
 * are per item. The inner join on `sales` is what scopes it to the shop and the
 * date range — sale_items carries neither.
 */
async function getTopProducts(
  { supabase, shopId }: ShopContext,
  from: Date,
  to: Date,
): Promise<ProfitReport["topProducts"]> {
  const { data, error } = await supabase
    .from("sale_items")
    .select(
      `
      quantity,
      actual_selling_price,
      profit,
      sales!inner ( shop_id, sale_date ),
      stock_batches (
        products ( product_name )
      )
    `,
    )
    .eq("sales.shop_id", shopId)
    .gte("sales.sale_date", from.toISOString())
    .lt("sales.sale_date", to.toISOString());

  if (error) {
    throw error;
  }

  const totals = new Map<
    string,
    { quantitySold: number; revenue: number; profit: number }
  >();

  for (const row of (data ?? []) as TopProductRow[]) {
    const batch = Array.isArray(row.stock_batches)
      ? row.stock_batches[0]
      : row.stock_batches;
    const product = Array.isArray(batch?.products)
      ? batch?.products[0]
      : batch?.products;

    // A deleted product cascades its batches away and leaves sale_items with a
    // null batch link. The money was still earned, so it is grouped under a
    // placeholder rather than dropped from the report.
    const name = product?.product_name ?? "Deleted product";
    const existing = totals.get(name) ?? {
      quantitySold: 0,
      revenue: 0,
      profit: 0,
    };

    totals.set(name, {
      quantitySold: existing.quantitySold + row.quantity,
      revenue:
        existing.revenue + row.quantity * toNumber(row.actual_selling_price),
      profit: existing.profit + toNumber(row.profit),
    });
  }

  return [...totals.entries()]
    .map(([productName, figures]) => ({ productName, ...figures }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10);
}
