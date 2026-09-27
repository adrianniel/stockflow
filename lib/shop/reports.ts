import { toNumber } from "@/lib/utils/format";
import { LOW_STOCK_THRESHOLD } from "./inventory-status";

import type { ShopContext } from "./context";
import {
  addDays,
  dateKey,
  daysBetween,
  parseDateKey,
  startOfDay,
  type ReportRange,
  type SaleFilter,
} from "./report-range";
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

/**
 * Ceiling on rows fetched for one aggregate.
 *
 * PostgREST caps responses at `max_rows` (1000, supabase/config.toml) and gives
 * no signal that it did. Asking for one more row than we intend to allow turns
 * that silent truncation into something detectable: if a query comes back at
 * this length, the range held more data than the aggregation can see and the
 * caller throws rather than reporting a total that is quietly too low.
 */
const ROW_CEILING = 900;

export type SalesSummary = {
  saleCount: number;
  itemCount: number;
  totalSales: number;
  /**
   * Capital tied up in what was sold: revenue minus profit.
   *
   * Derived rather than summed because `sale_items.profit` is already stored
   * per line against the batch price actually paid, so revenue - profit is the
   * cost of those exact units. Nothing extra has to be fetched for it.
   */
  totalCost: number;
  totalProfit: number;
  /** Sales profit after active operating expenses for the same dates. */
  totalExpenses: number;
  /**
   * Cash actually received in this range, from `sale_payments.collected_at`.
   *
   * Deliberately not derived from the sales in the range. A 500 utang sold on
   * Monday and paid on Friday is 500 of Monday's *sales* and 500 of Friday's
   * *collections*, and an owner reconciling the drawer on Friday needs the
   * second number. Summing `sales.amount_paid` over Monday's sales answers
   * neither question: it credits Friday's cash to Monday, and it moves
   * retroactively as instalments arrive, so last week's report changes.
   */
  totalCollected: number;
  /**
   * Unpaid balance across CREDIT and PARTIAL sales in the range.
   *
   * A present-tense figure: what is still owed on those sales as of now, not
   * what was owed at the end of the range. It therefore falls as debts are
   * collected, which is what makes it useful for chasing them.
   */
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
  /** The range these figures cover, echoed back for the page's own labelling. */
  range: ReportRange;
  /** Totals across the whole range. */
  total: SalesSummary;
  today: SalesSummary;
  last7Days: SalesSummary;
  thisMonth: SalesSummary;
  /** Newest first, for the daily breakdown table. One row per day in range. */
  dailyBreakdown: Array<{ date: string; summary: SalesSummary }>;
  topProducts: Array<{
    productName: string;
    quantitySold: number;
    revenue: number;
    profit: number;
  }>;
};

/** One day, split into what was sold and what was collected. */
export type DayDetail = {
  date: string;
  /** Sales recorded on this date, keyed on sale_date. */
  sales: DaySale[];
  /** Payments received on this date, keyed on collected_at. */
  collections: DayCollection[];
  expenses: DayExpense[];
  /** Accrual figures for the sales above. */
  summary: SalesSummary;
};

export type DaySale = {
  id: string;
  saleDate: string | null;
  total: number;
  cost: number;
  profit: number;
  paid: number;
  itemCount: number;
  paymentStatus: PaymentStatus;
  sellerName: string | null;
  customerName: string | null;
  replacesSaleId: string | null;
};

export type DayCollection = {
  id: string;
  saleId: string;
  amount: number;
  collectedAt: string;
  note: string | null;
  collectedByName: string | null;
  customerName: string | null;
  /**
   * True when the parent sale was made on a different day. These are the rows
   * that make a day's collections exceed its sales, so the page marks them
   * rather than leaving the discrepancy unexplained.
   */
  fromEarlierSale: boolean;
};

export type DayExpense = {
  id: string;
  date: string;
  name: string;
  amount: number;
  notes: string | null;
  createdByName: string | null;
};

const EMPTY_SUMMARY: SalesSummary = {
  saleCount: 0,
  itemCount: 0,
  totalSales: 0,
  totalCost: 0,
  totalProfit: 0,
  totalExpenses: 0,
  totalCollected: 0,
  outstanding: 0,
};

// startOfDay, addDays and the YYYY-MM-DD key live in report-range.ts, which
// owns every local-date decision so the URL and the aggregation cannot disagree
// about where a day begins.

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
 *
 * `filter` narrows by payment status. It applies to sales only — collections
 * are never filtered this way, since a payment has no status of its own and its
 * parent's changes as it is paid off.
 */
async function loadSales(
  { supabase, shopId }: ShopContext,
  from: Date,
  to: Date,
  filter: SaleFilter = "all",
): Promise<SaleAggregateRow[]> {
  let query = supabase
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
    // A voided sale is not a sale. It contributes no revenue, no cost and no
    // profit, and the units it moved have gone back to their batches.
    .is("voided_at", null);

  if (filter !== "all") {
    query = query.eq("payment_status", filter);
  }

  const { data, error } = await query
    .order("sale_date", { ascending: false })
    .limit(ROW_CEILING);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as SaleAggregateRow[];

  assertNotTruncated(rows.length, "sales", from, to);

  return rows;
}

/**
 * Fails loudly when a result may have been cut short.
 *
 * Every figure on the reports page is summed from rows fetched here, so a
 * truncated result does not produce a visibly broken page — it produces a
 * plausible one with totals that are too low. That is the worst outcome
 * available: an owner reconciling a drawer against an under-reported total has
 * no way to tell the report is wrong. Throwing surfaces it as an error boundary
 * instead, which is recoverable by narrowing the range.
 */
function assertNotTruncated(
  count: number,
  what: string,
  from: Date,
  to: Date,
): void {
  if (count < ROW_CEILING) {
    return;
  }

  throw new Error(
    `Too many ${what} between ${dateKey(from)} and ${dateKey(to)} to total accurately ` +
      `(${ROW_CEILING}+ rows). Choose a shorter date range.`,
  );
}

type PaymentAggregateRow = {
  amount: string;
  collected_at: string;
};

type ExpenseAggregateRow = {
  id: string;
  expense_date: string;
  name: string;
  amount: string;
  notes: string | null;
  users: { name: string | null } | { name: string | null }[] | null;
};

/**
 * Loads payments collected in a half-open range [from, to).
 *
 * Filtered on `collected_at` — when the money arrived — rather than on the
 * parent sale's date, which is the whole point of the separate ledger.
 */
async function loadPayments(
  { supabase, shopId }: ShopContext,
  from: Date,
  to: Date,
): Promise<PaymentAggregateRow[]> {
  const { data, error } = await supabase
    .from("sale_payments")
    .select("amount, collected_at")
    .eq("shop_id", shopId)
    .gte("collected_at", from.toISOString())
    .lt("collected_at", to.toISOString())
    // Payments of a voided sale are kept on the sale for history but are not
    // cash the shop is holding, so they leave the collection figure with it.
    .is("voided_at", null)
    .limit(ROW_CEILING);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as PaymentAggregateRow[];

  assertNotTruncated(rows.length, "payments", from, to);

  return rows;
}

function sumPayments(rows: PaymentAggregateRow[]): number {
  return rows.reduce((total, row) => total + toNumber(row.amount), 0);
}

/**
 * Rolls up sales, plus the cash collected over the same range.
 *
 * The two arrive separately because they are filtered on different columns and
 * cannot come from one query — see SalesSummary.totalCollected.
 */
function summarize(
  rows: SaleAggregateRow[],
  collected: number,
  expenses: number,
): SalesSummary {
  const summary = rows.reduce<SalesSummary>((summary, row) => {
    const total = toNumber(row.total_amount);
    const paid = toNumber(row.amount_paid);
    const profit = toNumber(row.total_profit);

    return {
      saleCount: summary.saleCount + 1,
      itemCount:
        summary.itemCount +
        (row.sale_items ?? []).reduce((sum, item) => sum + item.quantity, 0),
      totalSales: summary.totalSales + total,
      // Revenue minus profit is what those units cost the shop, per the note on
      // SalesSummary.totalCost.
      totalCost: summary.totalCost + (total - profit),
      totalProfit: summary.totalProfit + profit,
      totalExpenses: summary.totalExpenses,
      totalCollected: 0,
      outstanding: summary.outstanding + (total - paid),
    };
  }, { ...EMPTY_SUMMARY });

  return {
    ...summary,
    totalCollected: collected,
    totalExpenses: expenses,
    totalProfit: summary.totalProfit - expenses,
  };
}

async function loadExpenses(
  { supabase, shopId }: ShopContext,
  from: Date,
  to: Date,
): Promise<ExpenseAggregateRow[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("id, expense_date, name, amount, notes, users!expenses_created_by_fkey ( name )")
    .eq("shop_id", shopId)
    .gte("expense_date", dateKey(from))
    .lt("expense_date", dateKey(to))
    .is("deleted_at", null)
    .order("expense_date", { ascending: false })
    .limit(ROW_CEILING);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ExpenseAggregateRow[];
  assertNotTruncated(rows.length, "expenses", from, to);
  return rows;
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

  const [todaySales, todayPayments, todayExpenses, productsResult, batchesResult] =
    await Promise.all([
      loadSales(context, todayStart, addDays(todayStart, 1)),
      loadPayments(context, todayStart, addDays(todayStart, 1)),
      loadExpenses(context, todayStart, addDays(todayStart, 1)),
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
    today: summarize(
      todaySales,
      sumPayments(todayPayments),
      todayExpenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0),
    ),
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
 * Figures for a chosen range, plus a per-day breakdown (SRS 12).
 *
 * Fetches the range once and derives every narrower figure in memory, so the
 * whole page costs two queries plus the product ranking regardless of how many
 * days are shown.
 *
 * Today / last 7 days / this month are always included even when the chosen
 * range does not contain them, because they are the figures an owner checks
 * first. When the range excludes them they simply come out empty, which is
 * accurate: the query covers the range that was asked for. They are computed by
 * intersecting with the range rather than by a second fetch.
 */
export async function getProfitReport(
  context: ShopContext,
  range: ReportRange,
): Promise<ProfitReport> {
  const now = new Date();
  const todayStart = startOfDay(now);

  // "Last 7 days" includes today, so it starts 6 days back.
  const weekStart = addDays(todayStart, -6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [rows, payments, expenses] = await Promise.all([
    loadSales(context, range.from, range.to, range.filter),
    loadPayments(context, range.from, range.to),
    loadExpenses(context, range.from, range.to),
  ]);

  // Clamped to the range so a headline figure never counts a day the range does
  // not cover, and never claims data the query did not fetch.
  const withinRange = (from: Date) => (from > range.from ? from : range.from);

  const inRange = (row: SaleAggregateRow, from: Date) =>
    row.sale_date !== null && new Date(row.sale_date) >= from;

  const collectedSince = (from: Date) =>
    sumPayments(
      payments.filter((payment) => new Date(payment.collected_at) >= from),
    );

  const expensesSince = (from: Date) =>
    expenses
      .filter((expense) => expense.expense_date >= dateKey(from))
      .reduce((sum, expense) => sum + toNumber(expense.amount), 0);

  const summaryFrom = (from: Date) => {
    // A boundary after the range's end selects nothing, which is right: asking
    // for "today" inside a range that ended last week has no sales in it.
    if (from >= range.to) {
      return { ...EMPTY_SUMMARY };
    }

    const start = withinRange(from);

    return summarize(
      rows.filter((row) => inRange(row, start)),
      collectedSince(start),
      expensesSince(start),
    );
  };

  const byDay = new Map<string, SaleAggregateRow[]>();

  for (const row of rows) {
    if (!row.sale_date) {
      continue;
    }

    const key = dateKey(new Date(row.sale_date));
    const bucket = byDay.get(key);

    if (bucket) {
      bucket.push(row);
    } else {
      byDay.set(key, [row]);
    }
  }

  // Bucketed on collected_at, so a day's row shows the cash that came in that
  // day — including instalments against sales made weeks earlier, which is why
  // a day can show collections larger than its own sales.
  const collectedByDay = new Map<string, number>();

  for (const payment of payments) {
    const key = dateKey(new Date(payment.collected_at));

    collectedByDay.set(
      key,
      (collectedByDay.get(key) ?? 0) + toNumber(payment.amount),
    );
  }

  const expensesByDay = new Map<string, number>();

  for (const expense of expenses) {
    expensesByDay.set(
      expense.expense_date,
      (expensesByDay.get(expense.expense_date) ?? 0) + toNumber(expense.amount),
    );
  }

  // Every day in the range gets a row, including days with no sales — a gap in
  // the table reads as missing data rather than as a quiet day. Newest first,
  // which is the order an owner reads a report in.
  const dayCount = daysBetween(range.from, range.to);
  const lastDay = addDays(range.to, -1);

  const dailyBreakdown = Array.from({ length: dayCount }, (_, index) => {
    const key = dateKey(addDays(lastDay, -index));

    return {
      date: key,
      summary: summarize(
        byDay.get(key) ?? [],
        collectedByDay.get(key) ?? 0,
        expensesByDay.get(key) ?? 0,
      ),
    };
  });

  return {
    range,
    total: summarize(
      rows,
      sumPayments(payments),
      expenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0),
    ),
    today: summaryFrom(todayStart),
    last7Days: summaryFrom(weekStart),
    thisMonth: summaryFrom(monthStart),
    dailyBreakdown,
    // Ranked over the chosen range rather than a fixed month, so the table
    // agrees with the rest of the page.
    topProducts: await getTopProducts(context, range.from, range.to),
  };
}

type DaySaleRow = {
  id: string;
  total_amount: string;
  total_profit: string;
  amount_paid: string;
  payment_status: PaymentStatus;
  sale_date: string | null;
  replaces_sale_id: string | null;
  users: { name: string | null } | { name: string | null }[] | null;
  customers: { name: string } | { name: string }[] | null;
  sale_items: Array<{ quantity: number }> | null;
};

type DayPaymentRow = {
  id: string;
  sale_id: string;
  amount: string;
  collected_at: string;
  note: string | null;
  users: { name: string | null } | { name: string | null }[] | null;
  sales: {
    sale_date: string | null;
    customers: { name: string } | { name: string }[] | null;
  } | Array<{
    sale_date: string | null;
    customers: { name: string } | { name: string }[] | null;
  }> | null;
};

/** PostgREST returns an embedded row as an object or a one-element array. */
function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

/**
 * Everything that happened on one day, split by what the two figures mean.
 *
 * `sales` is keyed on `sale_date` and `collections` on `collected_at`, and they
 * are deliberately not reconciled with each other. A day can collect more than
 * it sold — that is an instalment against an older utang arriving — and the two
 * lists together are what explain the difference. `summary` describes the sales
 * only, so the day's profit is the profit earned that day and does not move when
 * an old debt is settled later.
 */
export async function getDayDetail(
  context: ShopContext,
  key: string,
): Promise<DayDetail | null> {
  const { supabase, shopId } = context;
  const from = parseDateKey(key);

  if (!from) {
    return null;
  }

  const to = addDays(from, 1);

  const [salesResult, paymentsResult, expensesResult] = await Promise.all([
    supabase
      .from("sales")
      .select(
        `
        id,
        total_amount,
        total_profit,
        amount_paid,
        payment_status,
        sale_date,
        replaces_sale_id,
        users!sales_sold_by_fkey ( name ),
        customers ( name ),
        sale_items ( quantity )
      `,
      )
      .eq("shop_id", shopId)
      .gte("sale_date", from.toISOString())
      .lt("sale_date", to.toISOString())
      .is("voided_at", null)
      .order("sale_date", { ascending: false })
      .limit(ROW_CEILING),
    supabase
      .from("sale_payments")
      .select(
        `
        id,
        sale_id,
        amount,
        collected_at,
        note,
        users ( name ),
        sales ( sale_date, customers ( name ) )
      `,
      )
      .eq("shop_id", shopId)
      .gte("collected_at", from.toISOString())
      .lt("collected_at", to.toISOString())
      .is("voided_at", null)
      .order("collected_at", { ascending: false })
      .limit(ROW_CEILING),
    supabase
      .from("expenses")
      .select("id, expense_date, name, amount, notes, users!expenses_created_by_fkey ( name )")
      .eq("shop_id", shopId)
      .eq("expense_date", key)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(ROW_CEILING),
  ]);

  if (salesResult.error) {
    throw salesResult.error;
  }

  if (paymentsResult.error) {
    throw paymentsResult.error;
  }

  if (expensesResult.error) {
    throw expensesResult.error;
  }

  const saleRows = (salesResult.data ?? []) as DaySaleRow[];
  const paymentRows = (paymentsResult.data ?? []) as DayPaymentRow[];
  const expenseRows = (expensesResult.data ?? []) as ExpenseAggregateRow[];

  assertNotTruncated(saleRows.length, "sales", from, to);
  assertNotTruncated(paymentRows.length, "payments", from, to);
  assertNotTruncated(expenseRows.length, "expenses", from, to);

  const sales: DaySale[] = saleRows.map((row) => {
    const total = toNumber(row.total_amount);
    const profit = toNumber(row.total_profit);

    return {
      id: row.id,
      saleDate: row.sale_date,
      replacesSaleId: row.replaces_sale_id,
      total,
      // Same derivation as SalesSummary.totalCost: profit is already stored
      // against the batch price actually paid.
      cost: total - profit,
      profit,
      paid: toNumber(row.amount_paid),
      itemCount: (row.sale_items ?? []).reduce(
        (sum, item) => sum + item.quantity,
        0,
      ),
      paymentStatus: row.payment_status,
      sellerName: firstOf(row.users)?.name ?? null,
      customerName: firstOf(row.customers)?.name ?? null,
    };
  });

  const collections: DayCollection[] = paymentRows.map((row) => {
    const sale = firstOf(row.sales);
    const saleDate = sale?.sale_date ?? null;

    return {
      id: row.id,
      saleId: row.sale_id,
      amount: toNumber(row.amount),
      collectedAt: row.collected_at,
      note: row.note,
      collectedByName: firstOf(row.users)?.name ?? null,
      customerName: firstOf(sale?.customers)?.name ?? null,
      // Compared on the local calendar day, not on the instant, so a payment
      // taken at 8am against a sale made at 11pm the night before is correctly
      // marked as belonging to an earlier sale.
      fromEarlierSale:
        saleDate !== null && dateKey(new Date(saleDate)) !== key,
    };
  });

  const expenses: DayExpense[] = expenseRows.map((row) => ({
    id: row.id,
    date: row.expense_date,
    name: row.name,
    amount: toNumber(row.amount),
    notes: row.notes,
    createdByName: firstOf(row.users)?.name ?? null,
  }));

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return {
    date: key,
    sales,
    collections,
    expenses,
    summary: {
      saleCount: sales.length,
      itemCount: sales.reduce((sum, sale) => sum + sale.itemCount, 0),
      totalSales: sales.reduce((sum, sale) => sum + sale.total, 0),
      totalCost: sales.reduce((sum, sale) => sum + sale.cost, 0),
      totalProfit:
        sales.reduce((sum, sale) => sum + sale.profit, 0) - totalExpenses,
      totalExpenses,
      totalCollected: collections.reduce(
        (sum, payment) => sum + payment.amount,
        0,
      ),
      outstanding: sales.reduce((sum, sale) => sum + (sale.total - sale.paid), 0),
    },
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
      sales!inner ( shop_id, sale_date, voided_at ),
      stock_batches (
        products ( product_name )
      )
    `,
    )
    .eq("sales.shop_id", shopId)
    .gte("sales.sale_date", from.toISOString())
    .lt("sales.sale_date", to.toISOString())
    // Filtered through the join rather than on sale_items, which has no void
    // of its own — the line is cancelled because its sale is.
    .is("sales.voided_at", null)
    .limit(ROW_CEILING);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as TopProductRow[];

  // One sale contributes a row per line, so this ceiling is reached sooner than
  // the sales one. Same reasoning: a truncated ranking is a wrong ranking, and
  // it would not look wrong.
  assertNotTruncated(rows.length, "sale items", from, to);

  const totals = new Map<
    string,
    { quantitySold: number; revenue: number; profit: number }
  >();

  for (const row of rows) {
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
