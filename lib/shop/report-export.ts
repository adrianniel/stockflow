import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

import type { ShopContext } from "./context";
import {
  addDays,
  dateKey,
  parseDateKey,
  startOfDay,
} from "./report-range";
import type { PaymentStatus } from "./types";
import { toNumber } from "@/lib/utils/format";

export type ExportPeriod = "daily" | "week" | "month";

export type ExportRange = {
  period: ExportPeriod;
  from: Date;
  to: Date;
  fromKey: string;
  toKey: string;
  label: string;
};

export type ExportSaleItem = {
  productName: string;
  quantity: number;
  sellingPrice: number;
  revenue: number;
};

export type ExportSale = {
  id: string;
  saleDate: string | null;
  customerName: string | null;
  paymentStatus: PaymentStatus;
  total: number;
  profit: number;
  paid: number;
  outstanding: number;
  items: ExportSaleItem[];
};

export type ExportCollection = {
  id: string;
  collectedAt: string;
  saleDate: string | null;
  saleId: string;
  customerName: string | null;
  amount: number;
  note: string | null;
  collectedByName: string | null;
};

export type ExportCredit = {
  customerName: string;
  outstanding: number;
};

export type ExportExpense = {
  id: string;
  date: string;
  name: string;
  amount: number;
  notes: string | null;
  createdByName: string | null;
};

export type SalesExportData = {
  range: ExportRange;
  sales: ExportSale[];
  collections: ExportCollection[];
  credits: ExportCredit[];
  expenses: ExportExpense[];
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalExpenses: number;
};

type Embedded<T> = T | T[] | null;

type SaleRow = {
  id: string;
  sale_date: string | null;
  total_amount: string;
  total_profit: string;
  amount_paid: string;
  payment_status: PaymentStatus;
  customers: Embedded<{ name: string }>;
  sale_items: Array<{
    quantity: number;
    capital_price: string;
    actual_selling_price: string;
    stock_batches: Embedded<{
      products: Embedded<{ product_name: string }>;
    }>;
  }> | null;
};

type PaymentRow = {
  id: string;
  amount: string;
  collected_at: string;
  note: string | null;
  users: Embedded<{ name: string | null }>;
  sales: Embedded<{
    id: string;
    sale_date: string | null;
    customers: Embedded<{ name: string }>;
  }>;
};

type ExpenseRow = {
  id: string;
  expense_date: string;
  name: string;
  amount: string;
  notes: string | null;
  users: Embedded<{ name: string | null }>;
};

function one<T>(value: Embedded<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function parseExportRange(
  period: string | null,
  date: string | null,
  now: Date = new Date(),
): ExportRange | null {
  const today = startOfDay(now);

  if (period === "daily") {
    const day = date ? parseDateKey(date) : today;

    if (!day) {
      return null;
    }

    return makeRange("daily", day, addDays(day, 1), "Daily");
  }

  // Week and month boundaries come from the shop's calendar date (Manila), not
  // the server clock. `today` is Manila midnight, which is 16:00 UTC the day
  // before, so reading it with getDay()/getMonth() on a UTC server (Vercel)
  // returned the previous day: the week started on Tuesday and, on the 1st,
  // "This month" covered the whole previous month.
  const todayKey = dateKey(now);

  if (period === "week") {
    const [year, month, day] = todayKey.split("-").map(Number);
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const from = addDays(today, -daysSinceMonday);

    return makeRange("week", from, addDays(today, 1), "This week");
  }

  if (period === "month") {
    const from = parseDateKey(`${todayKey.slice(0, 7)}-01`) as Date;

    return makeRange("month", from, addDays(today, 1), "This month");
  }

  return null;
}

function makeRange(
  period: ExportPeriod,
  from: Date,
  to: Date,
  label: string,
): ExportRange {
  return {
    period,
    from,
    to,
    fromKey: dateKey(from),
    toKey: dateKey(addDays(to, -1)),
    label,
  };
}

export async function getSalesExportData(
  { supabase, shopId }: ShopContext,
  range: ExportRange,
): Promise<SalesExportData> {
  // Each list is paged so a busy period's PDF includes every row. A single
  // request stops at 1000 rows without an error, which would make the export
  // quietly under-report revenue, profit, and collections.
  const [saleRows, paymentRows, expenseRows] = await Promise.all([
    fetchAllRows<SaleRow>((from, to) =>
      supabase
        .from("sales")
        .select(
          `
        id,
        sale_date,
        total_amount,
        total_profit,
        amount_paid,
        payment_status,
        customers ( name ),
        sale_items (
          quantity,
          capital_price,
          actual_selling_price,
          stock_batches ( products ( product_name ) )
        )
      `,
        )
        .eq("shop_id", shopId)
        .gte("sale_date", range.from.toISOString())
        .lt("sale_date", range.to.toISOString())
        .is("voided_at", null)
        .order("sale_date", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<PaymentRow>((from, to) =>
      supabase
        .from("sale_payments")
        .select(
          `
        id,
        amount,
        collected_at,
        note,
        users ( name ),
        sales!inner ( id, sale_date, customers ( name ) )
      `,
        )
        .eq("shop_id", shopId)
        .gte("collected_at", range.from.toISOString())
        .lt("collected_at", range.to.toISOString())
        .is("voided_at", null)
        .is("sales.voided_at", null)
        .order("collected_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<ExpenseRow>((from, to) =>
      supabase
        .from("expenses")
        .select("id, expense_date, name, amount, notes, users!expenses_created_by_fkey ( name )")
        .eq("shop_id", shopId)
        .gte("expense_date", range.fromKey)
        .lte("expense_date", range.toKey)
        .is("deleted_at", null)
        .order("expense_date", { ascending: false })
        .order("id")
        .range(from, to),
    ),
  ]);

  const sales = saleRows.map((row) => {
    const items = (row.sale_items ?? []).map((item) => {
      const quantity = item.quantity;
      const sellingPrice = toNumber(item.actual_selling_price);

      return {
        productName:
          one(one(item.stock_batches)?.products)?.product_name ??
          "Deleted product",
        quantity,
        sellingPrice,
        revenue: sellingPrice * quantity,
      };
    });

    const total = toNumber(row.total_amount);
    const paid = toNumber(row.amount_paid);

    return {
      id: row.id,
      saleDate: row.sale_date,
      customerName: one(row.customers)?.name ?? null,
      paymentStatus: row.payment_status,
      total,
      profit: toNumber(row.total_profit),
      paid,
      outstanding: Math.max(total - paid, 0),
      items,
    };
  });

  const collections = paymentRows.map((row) => {
    const sale = one(row.sales);

    return {
      id: row.id,
      collectedAt: row.collected_at,
      saleDate: sale?.sale_date ?? null,
      saleId: sale?.id ?? "Unknown sale",
      customerName: one(sale?.customers ?? null)?.name ?? null,
      amount: toNumber(row.amount),
      note: row.note,
      collectedByName: one(row.users)?.name ?? null,
    };
  });

  const credits = new Map<string, number>();

  for (const sale of sales) {
    if (sale.customerName && sale.outstanding > 0) {
      credits.set(
        sale.customerName,
        (credits.get(sale.customerName) ?? 0) + sale.outstanding,
      );
    }
  }

  const expenses = expenseRows.map((expense) => ({
    id: expense.id,
    date: expense.expense_date,
    name: expense.name,
    amount: toNumber(expense.amount),
    notes: expense.notes,
    createdByName: one(expense.users)?.name ?? null,
  }));

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return {
    range,
    sales,
    collections,
    expenses,
    credits: [...credits.entries()]
      .map(([customerName, outstanding]) => ({ customerName, outstanding }))
      .sort((a, b) => b.outstanding - a.outstanding),
    totalRevenue: sales.reduce((sum, sale) => sum + sale.total, 0),
    totalCost: sales.reduce((sum, sale) => sum + (sale.total - sale.profit), 0),
    totalProfit: sales.reduce((sum, sale) => sum + sale.profit, 0) - totalExpenses,
    totalExpenses,
  };
}
