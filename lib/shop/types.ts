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
};

export type Sale = {
  id: string;
  total_amount: string;
  total_profit: string;
  amount_paid: string;
  payment_status: PaymentStatus;
  sale_date: string | null;
  sold_by: string | null;
};

export type SaleWithSeller = Sale & {
  seller_name: string | null;
  item_count: number;
};

export type SaleItem = {
  id: string;
  quantity: number;
  capital_price: string;
  suggested_price: string;
  actual_selling_price: string;
  profit: string;
  stock_batch_id: string | null;
  product_name: string | null;
  batch_number: string | null;
};

export type StockAdjustment = {
  id: string;
  quantity_change: number;
  reason: string;
  created_at: string | null;
  batch_number: string | null;
  product_name: string | null;
  adjusted_by_name: string | null;
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

/** One line of a sale being composed in the browser, before it is submitted. */
export type CartLine = {
  productId: string;
  productName: string;
  quantity: number;
  /** Blank means "use the batch's own selling price" (no discount). */
  actualSellingPrice: number | null;
  suggestedPrice: number;
  quantityAvailable: number;
};
