/**
 * Row shapes for the tables a shop user works with.
 *
 * These are hand-written rather than generated from the database because the
 * project has no codegen step yet. They describe what the queries in this
 * directory actually select, not the full table — a query that selects more
 * columns should widen the type it returns rather than reuse one of these.
 *
 * `numeric` columns are typed `string`. supabase-js returns Postgres numerics as
 * strings to avoid the precision loss of a float round-trip, and money must not
 * lose precision. Use the helpers in lib/utils/format for display and
 * `toNumber` before arithmetic.
 */

import type { UserRole, UserStatus } from "@/lib/auth/roles";

export type Category = {
  id: string;
  name: string;
  created_at: string | null;
};

export type Product = {
  id: string;
  product_name: string;
  brand: string | null;
  description: string | null;
  category_id: string | null;
  created_at: string | null;
};

/** A product row joined to its category name, as the product list renders it. */
export type ProductWithCategory = Product & {
  category_name: string | null;
};

export type StockBatch = {
  id: string;
  product_id: string;
  batch_number: string;
  quantity_received: number;
  quantity_remaining: number;
  capital_price: string;
  interest_percentage: string;
  selling_price: string;
  received_date: string | null;
  created_at: string | null;
};

/** One in-stock batch as the sale composer offers it. */
export type SellableBatch = {
  id: string;
  batchNumber: string;
  receivedDate: string | null;
  quantityRemaining: number;
  sellingPrice: number;
};

/**
 * One product's inventory position, aggregated across its batches.
 *
 * `stockValue` is valued at capital price, not selling price: it answers "how
 * much money is sitting on the shelf", which is what the shop actually paid.
 */
export type InventoryLine = {
  productId: string;
  productName: string;
  brand: string | null;
  categoryName: string | null;
  quantityOnHand: number;
  batchCount: number;
  stockValue: number;
  /** Price a new sale would suggest — the oldest in-stock batch, per FIFO. */
  currentSellingPrice: number | null;
  /** In-stock batches, oldest first. What the till offers for selection. */
  batches: SellableBatch[];
};

export type Sale = {
  id: string;
  total_amount: string;
  total_profit: string;
  amount_paid: string;
  payment_status: PaymentStatus;
  sale_date: string | null;
  sold_by: string | null;
  customer_id: string | null;
  replaces_sale_id: string | null;
  /**
   * Set once the sale has been cancelled. A voided sale keeps its row, its
   * line items and its payment history, but counts for nothing: it is out of
   * every report, out of every balance owed, and its stock has gone back to
   * the batches it came from.
   *
   * `payment_status` on a voided sale is meaningless — the recompute trigger
   * drops it to CREDIT once the payments are marked voided — so show the void
   * instead of the status.
   */
  voided_at: string | null;
  void_reason: string | null;
};

export type SaleWithSeller = Sale & {
  seller_name: string | null;
  customer_name: string | null;
  voided_by_name: string | null;
  item_count: number;
};

export type SaleItem = {
  id: string;
  product_id: string | null;
  quantity: number;
  capital_price: string;
  suggested_price: string;
  actual_selling_price: string;
  profit: string;
  stock_batch_id: string | null;
  product_name: string | null;
  batch_number: string | null;
  /** Shown beside the reference, which is free-form and may repeat. */
  batch_received_date: string | null;
  batch_quantity_remaining: number | null;
  batch_selling_price: string | null;
};

export type StockAdjustment = {
  id: string;
  quantity_change: number;
  reason: string;
  created_at: string | null;
  batch_number: string | null;
  /** Shown beside the reference, which is free-form and may repeat. */
  batch_received_date: string | null;
  product_name: string | null;
  adjusted_by_name: string | null;
};

export type Expense = {
  id: string;
  expense_date: string;
  name: string;
  amount: string;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by_name: string | null;
};

/**
 * A named credit customer.
 *
 * Text only, by design — a customer is a name, optionally a phone number, and
 * optionally a short note. Nothing here is large enough to matter against the
 * database size limit even for a shop with thousands of regulars.
 */
export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at: string | null;
};

/**
 * A customer with their debt position, as the credit page lists them.
 *
 * `outstanding` is the sum of (total_amount - amount_paid) over their unsettled
 * sales, so it is what they owe right now rather than what they have ever been
 * lent.
 */
export type CustomerWithBalance = Customer & {
  outstanding: number;
  unpaidSaleCount: number;
  /** Oldest sale_date among their unsettled sales, for "owing since". */
  oldestUnpaidDate: string | null;
};

/** One instalment received against a sale. */
export type SalePayment = {
  id: string;
  amount: string;
  collected_at: string;
  created_at: string;
  note: string | null;
  collected_by_name: string | null;
  /**
   * Set when the parent sale was voided. The money is no longer counted
   * anywhere, but the row stays so the sale can still show what was collected
   * and when, which is the point of voiding rather than deleting.
   */
  voided_at: string | null;
};

/**
 * A person with a login for this shop, as the assistants page lists them.
 *
 * `email` is the display copy on `public.users`, not the authoritative address
 * in `auth.users` — reading that needs the admin API and therefore the
 * service_role key. Rows created before the copy existed have null here.
 */
export type ShopMember = {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string | null;
  /** True for the row belonging to the signed-in user. */
  isSelf: boolean;
};

export const PAYMENT_STATUSES = ["PAID", "PARTIAL", "CREDIT"] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return (
    typeof value === "string" &&
    PAYMENT_STATUSES.includes(value as PaymentStatus)
  );
}

/**
 * One line of a sale being composed in the browser, before it is submitted.
 *
 * A line is one product out of one batch, so the same product may appear on
 * several lines — that is how a quantity larger than any single batch is sold.
 * `stockBatchId` is what makes a line unique; the product id alone does not.
 */
export type CartLine = {
  productId: string;
  productName: string;
  stockBatchId: string;
  batchNumber: string;
  batchReceivedDate: string | null;
  quantity: number;
  /** Blank means "use the batch's own selling price" (no discount). */
  actualSellingPrice: number | null;
  suggestedPrice: number;
  /** Remaining in *this batch*, not across the product. */
  quantityAvailable: number;
};
