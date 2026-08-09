import { formatCurrency, formatDateKey, toNumber } from "@/lib/utils/format";

import type { ShopContext } from "./context";
import type {
  Category,
  Customer,
  CustomerWithBalance,
  InventoryLine,
  PaymentStatus,
  ProductWithCategory,
  SaleItem,
  SalePayment,
  SaleWithSeller,
  ShopMember,
  StockAdjustment,
  StockBatch,
} from "./types";

/**
 * Every read for the shop-facing pages.
 *
 * Two conventions hold throughout:
 *
 * 1. Queries filter on `shop_id` explicitly even though RLS already scopes
 *    them. RLS is the security boundary and stays the backstop; the explicit
 *    filter is what makes the intent readable and keeps the query honest if a
 *    policy is ever loosened.
 *
 * 2. Errors are thrown, not swallowed. These run inside Server Components, so a
 *    throw becomes the route's error boundary. A query that silently returned []
 *    on failure would render "no products yet" over a database outage, and the
 *    shop would think its catalogue had been wiped.
 */

/** Postgrest embeds a to-one relation as an object, or null. */
type Embedded<T> = T | T[] | null;

/**
 * Normalises an embedded relation to a single row.
 *
 * supabase-js types some to-one embeds as arrays depending on how it infers the
 * relationship, so both shapes have to be handled to keep the callers clean.
 */
function one<T>(value: Embedded<T>): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listCategories({
  supabase,
  shopId,
}: ShopContext): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, created_at")
    .eq("shop_id", shopId)
    .order("name");

  if (error) {
    throw error;
  }

  return (data ?? []) as Category[];
}

/** Category list with how many products each holds, for the delete warning. */
export async function listCategoriesWithCounts(
  context: ShopContext,
): Promise<Array<Category & { productCount: number }>> {
  const [categories, products] = await Promise.all([
    listCategories(context),
    listProducts(context),
  ]);

  const counts = new Map<string, number>();

  for (const product of products) {
    if (product.category_id) {
      counts.set(product.category_id, (counts.get(product.category_id) ?? 0) + 1);
    }
  }

  return categories.map((category) => ({
    ...category,
    productCount: counts.get(category.id) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

type ProductRow = {
  id: string;
  product_name: string;
  brand: string | null;
  description: string | null;
  category_id: string | null;
  created_at: string | null;
  categories: Embedded<{ name: string }>;
};

export async function listProducts({
  supabase,
  shopId,
}: ShopContext): Promise<ProductWithCategory[]> {
  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id,
      product_name,
      brand,
      description,
      category_id,
      created_at,
      categories ( name )
    `,
    )
    .eq("shop_id", shopId)
    .order("product_name");

  if (error) {
    throw error;
  }

  return ((data ?? []) as ProductRow[]).map((row) => ({
    id: row.id,
    product_name: row.product_name,
    brand: row.brand,
    description: row.description,
    category_id: row.category_id,
    created_at: row.created_at,
    category_name: one(row.categories)?.name ?? null,
  }));
}

export async function getProduct(
  { supabase, shopId }: ShopContext,
  productId: string,
): Promise<ProductWithCategory | null> {
  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id,
      product_name,
      brand,
      description,
      category_id,
      created_at,
      categories ( name )
    `,
    )
    .eq("shop_id", shopId)
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as ProductRow;

  return {
    id: row.id,
    product_name: row.product_name,
    brand: row.brand,
    description: row.description,
    category_id: row.category_id,
    created_at: row.created_at,
    category_name: one(row.categories)?.name ?? null,
  };
}

// ---------------------------------------------------------------------------
// Stock batches and inventory
// ---------------------------------------------------------------------------

export async function listBatchesForProduct(
  { supabase, shopId }: ShopContext,
  productId: string,
): Promise<StockBatch[]> {
  const { data, error } = await supabase
    .from("stock_batches")
    .select(
      `
      id,
      product_id,
      batch_number,
      quantity_received,
      quantity_remaining,
      capital_price,
      interest_percentage,
      selling_price,
      received_date,
      created_at
    `,
    )
    .eq("shop_id", shopId)
    .eq("product_id", productId)
    // FIFO order, matching record_sale()'s consumption order so the page shows
    // batches in the sequence they will actually be drawn down.
    .order("received_date")
    .order("created_at");

  if (error) {
    throw error;
  }

  return (data ?? []) as StockBatch[];
}

type InventoryBatchRow = {
  id: string;
  product_id: string;
  batch_number: string;
  quantity_remaining: number;
  capital_price: string;
  selling_price: string;
  received_date: string | null;
  created_at: string | null;
};

/**
 * Inventory position per product.
 *
 * Aggregated in application code rather than SQL because PostgREST cannot
 * express `GROUP BY` without a database view, and adding one for a shop-sized
 * batch table is not worth the migration. Revisit if a shop's batch count grows
 * into the tens of thousands.
 */
export async function listInventory(
  context: ShopContext,
  { includeEmptyBatches = false }: { includeEmptyBatches?: boolean } = {},
): Promise<InventoryLine[]> {
  const { supabase, shopId } = context;

  const [products, batchesResult] = await Promise.all([
    listProducts(context),
    supabase
      .from("stock_batches")
      .select(
        `
        id,
        product_id,
        batch_number,
        quantity_remaining,
        capital_price,
        selling_price,
        received_date,
        created_at
      `,
      )
      .eq("shop_id", shopId)
      .order("received_date")
      .order("created_at"),
  ]);

  if (batchesResult.error) {
    throw batchesResult.error;
  }

  const batches = (batchesResult.data ?? []) as InventoryBatchRow[];
  const byProduct = new Map<string, InventoryBatchRow[]>();

  for (const batch of batches) {
    const existing = byProduct.get(batch.product_id);

    if (existing) {
      existing.push(batch);
    } else {
      byProduct.set(batch.product_id, [batch]);
    }
  }

  return products.map((product) => {
    // Already in FIFO order from the query, so the first in-stock batch is the
    // one a sale would consume first.
    const productBatches = byProduct.get(product.id) ?? [];
    const inStock = productBatches.filter((b) => b.quantity_remaining > 0);
    const displayedBatches = includeEmptyBatches ? productBatches : inStock;

    const quantityOnHand = inStock.reduce(
      (total, batch) => total + batch.quantity_remaining,
      0,
    );

    const stockValue = inStock.reduce(
      (total, batch) =>
        total + batch.quantity_remaining * toNumber(batch.capital_price),
      0,
    );

    return {
      productId: product.id,
      productName: product.product_name,
      brand: product.brand,
      categoryName: product.category_name,
      quantityOnHand,
      batchCount: inStock.length,
      stockValue,
      currentSellingPrice: inStock[0]
        ? toNumber(inStock[0].selling_price)
        : null,
      // Still in FIFO order, so the till can pre-select `batches[0]` and get
      // the same batch record_sale() would have chosen on its own.
      batches: displayedBatches.map((batch) => ({
        id: batch.id,
        batchNumber: batch.batch_number,
        receivedDate: batch.received_date,
        quantityRemaining: batch.quantity_remaining,
        sellingPrice: toNumber(batch.selling_price),
      })),
    };
  });
}

/** Products with stock available to sell, for the new-sale product picker. */
export async function listSellableProducts(
  context: ShopContext,
): Promise<InventoryLine[]> {
  const inventory = await listInventory(context);

  return inventory.filter((line) => line.quantityOnHand > 0);
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

type SaleRow = {
  id: string;
  total_amount: string;
  total_profit: string;
  amount_paid: string;
  payment_status: PaymentStatus;
  sale_date: string | null;
  sold_by: string | null;
  customer_id: string | null;
  replaces_sale_id: string | null;
  voided_at: string | null;
  void_reason: string | null;
  users: Embedded<{ name: string | null }>;
  voided_by_user: Embedded<{ name: string | null }>;
  customers: Embedded<{ name: string }>;
  sale_items: Array<{ id: string }> | null;
};

const SALE_SELECT = `
  id,
  total_amount,
  total_profit,
  amount_paid,
  payment_status,
  sale_date,
  sold_by,
  customer_id,
  replaces_sale_id,
  voided_at,
  void_reason,
  users!sales_sold_by_fkey ( name ),
  voided_by_user:users!sales_voided_by_fkey ( name ),
  customers ( name ),
  sale_items ( id )
`;

function toSaleWithSeller(row: SaleRow): SaleWithSeller {
  return {
    id: row.id,
    total_amount: row.total_amount,
    total_profit: row.total_profit,
    amount_paid: row.amount_paid,
    payment_status: row.payment_status,
    sale_date: row.sale_date,
    sold_by: row.sold_by,
    customer_id: row.customer_id,
    replaces_sale_id: row.replaces_sale_id,
    voided_at: row.voided_at,
    void_reason: row.void_reason,
    seller_name: one(row.users)?.name ?? null,
    customer_name: one(row.customers)?.name ?? null,
    voided_by_name: one(row.voided_by_user)?.name ?? null,
    item_count: row.sale_items?.length ?? 0,
  };
}

/**
 * The most recent transactions, voided ones included.
 *
 * Voided sales stay in this list on purpose. The shop needs to be able to see
 * that a transaction was recorded and then cancelled — a sale that simply
 * vanished from the history is indistinguishable from one that was never
 * entered, and that is the question someone asks when the drawer does not
 * balance. They are excluded from reports and from balances owed instead, which
 * is where counting them would actually be wrong.
 */
export async function listSales(
  { supabase, shopId }: ShopContext,
  { limit = 50 }: { limit?: number } = {},
): Promise<SaleWithSeller[]> {
  const { data, error } = await supabase
    .from("sales")
    .select(SALE_SELECT)
    .eq("shop_id", shopId)
    .order("sale_date", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return ((data ?? []) as SaleRow[]).map(toSaleWithSeller);
}

export async function getSale(
  { supabase, shopId }: ShopContext,
  saleId: string,
): Promise<SaleWithSeller | null> {
  const { data, error } = await supabase
    .from("sales")
    .select(SALE_SELECT)
    .eq("shop_id", shopId)
    .eq("id", saleId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toSaleWithSeller(data as SaleRow) : null;
}

/** Returns the direct replacement, if this sale has already been amended. */
export async function getReplacementSale(
  { supabase, shopId }: ShopContext,
  originalSaleId: string,
): Promise<SaleWithSeller | null> {
  const { data, error } = await supabase
    .from("sales")
    .select(SALE_SELECT)
    .eq("shop_id", shopId)
    .eq("replaces_sale_id", originalSaleId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toSaleWithSeller(data as SaleRow) : null;
}

type SaleItemRow = {
  id: string;
  product_id: string | null;
  quantity: number;
  capital_price: string;
  suggested_price: string;
  actual_selling_price: string;
  profit: string;
  stock_batch_id: string | null;
  stock_batches: Embedded<{
    product_id: string;
    batch_number: string;
    received_date: string | null;
    quantity_remaining: number;
    selling_price: string;
    products: Embedded<{ product_name: string }>;
  }>;
};

/**
 * Line items of one sale.
 *
 * Not filtered on shop_id — `sale_items` has no such column. Isolation comes
 * from its RLS policy, which joins through `sales`, and from the caller having
 * already resolved the sale through `getSale` under the shop filter.
 */
export async function listSaleItems(
  { supabase }: ShopContext,
  saleId: string,
): Promise<SaleItem[]> {
  const { data, error } = await supabase
    .from("sale_items")
    .select(
      `
      id,
      stock_batches ( product_id, batch_number, received_date, quantity_remaining, selling_price, products ( product_name ) ),
      quantity,
      capital_price,
      suggested_price,
      actual_selling_price,
      profit,
      stock_batch_id
    `,
    )
    .eq("sale_id", saleId)
    .order("created_at");

  if (error) {
    throw error;
  }

  return ((data ?? []) as SaleItemRow[]).map((row) => {
    const batch = one(row.stock_batches);

    return {
      id: row.id,
      product_id: batch?.product_id ?? null,
      quantity: row.quantity,
      capital_price: row.capital_price,
      suggested_price: row.suggested_price,
      actual_selling_price: row.actual_selling_price,
      profit: row.profit,
      stock_batch_id: row.stock_batch_id,
      batch_number: batch?.batch_number ?? null,
      batch_received_date: batch?.received_date ?? null,
      product_name: one(batch?.products ?? null)?.product_name ?? null,
      batch_quantity_remaining: batch?.quantity_remaining ?? null,
      batch_selling_price: batch?.selling_price ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Customers and credit
// ---------------------------------------------------------------------------

const CUSTOMER_SELECT = "id, name, phone, notes, created_at";

export async function listCustomers({
  supabase,
  shopId,
}: ShopContext): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_SELECT)
    .eq("shop_id", shopId)
    .order("name");

  if (error) {
    throw error;
  }

  return (data ?? []) as Customer[];
}

export async function getCustomer(
  { supabase, shopId }: ShopContext,
  customerId: string,
): Promise<Customer | null> {
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_SELECT)
    .eq("shop_id", shopId)
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as Customer | null) ?? null;
}

type UnpaidSaleRow = {
  id: string;
  customer_id: string | null;
  total_amount: string;
  amount_paid: string;
  sale_date: string | null;
};

/**
 * Every customer with what they currently owe.
 *
 * The balance is aggregated in Node rather than in SQL because doing it in
 * Postgres needs either a view or an RPC, and the row count here is naturally
 * small: only unsettled sales are fetched, and a shop with more than a few
 * hundred open debts has a collections problem rather than a reporting one.
 * If that assumption ever breaks, this becomes a SQL aggregate — the shape of
 * the return value is chosen so that swap needs no caller changes.
 *
 * Customers with nothing outstanding are included, with a zero balance, so the
 * page can serve as the shop's customer list as well as its debt list.
 */
export async function listCustomersWithBalances(
  context: ShopContext,
): Promise<CustomerWithBalance[]> {
  const { supabase, shopId } = context;

  const [customers, unpaid] = await Promise.all([
    listCustomers(context),
    supabase
      .from("sales")
      .select("id, customer_id, total_amount, amount_paid, sale_date")
      .eq("shop_id", shopId)
      .not("customer_id", "is", null)
      .neq("payment_status", "PAID")
      // Voiding a credit sale marks its payments voided, which drops
      // amount_paid to 0 and payment_status to CREDIT — the exact shape of an
      // uncollected debt. Without this filter a cancelled sale would go on
      // being chased, and for its full value.
      .is("voided_at", null)
      .order("sale_date"),
  ]);

  if (unpaid.error) {
    throw unpaid.error;
  }

  const balances = new Map<
    string,
    { outstanding: number; count: number; oldest: string | null }
  >();

  for (const row of (unpaid.data ?? []) as UnpaidSaleRow[]) {
    if (!row.customer_id) {
      continue;
    }

    const entry = balances.get(row.customer_id) ?? {
      outstanding: 0,
      count: 0,
      oldest: null,
    };

    entry.outstanding += toNumber(row.total_amount) - toNumber(row.amount_paid);
    entry.count += 1;

    // Rows arrive oldest-first, so the first one seen for a customer is the
    // one they have owed the longest.
    entry.oldest ??= row.sale_date;

    balances.set(row.customer_id, entry);
  }

  return customers.map((customer) => {
    const entry = balances.get(customer.id);

    return {
      ...customer,
      outstanding: entry?.outstanding ?? 0,
      unpaidSaleCount: entry?.count ?? 0,
      oldestUnpaidDate: entry?.oldest ?? null,
    };
  });
}

/** One customer's unsettled sales, oldest first — the order to collect in. */
export async function listCustomerUnpaidSales(
  { supabase, shopId }: ShopContext,
  customerId: string,
): Promise<SaleWithSeller[]> {
  const { data, error } = await supabase
    .from("sales")
    .select(SALE_SELECT)
    .eq("shop_id", shopId)
    .eq("customer_id", customerId)
    .neq("payment_status", "PAID")
    // Same reason as listCustomersWithBalances: a voided sale reads as CREDIT
    // with nothing paid, and nothing is owed on it.
    .is("voided_at", null)
    .order("sale_date");

  if (error) {
    throw error;
  }

  return ((data ?? []) as SaleRow[]).map(toSaleWithSeller);
}

type SalePaymentRow = {
  id: string;
  amount: string;
  collected_at: string;
  created_at: string;
  note: string | null;
  voided_at: string | null;
  users: Embedded<{ name: string | null }>;
};

/**
 * The instalments recorded against one sale.
 *
 * Ordered by collected_at, which is when the money arrived — not created_at,
 * which is when the row was typed in. A payment entered the next morning
 * belongs in the sequence where it was collected.
 *
 * Payments voided along with their sale are returned too, marked. They no
 * longer count towards anything, but the sale page is the one place the shop
 * can see what was collected before the sale was cancelled.
 */
export async function listSalePayments(
  { supabase, shopId }: ShopContext,
  saleId: string,
): Promise<SalePayment[]> {
  const { data, error } = await supabase
    .from("sale_payments")
    .select("id, amount, collected_at, created_at, note, voided_at, users ( name )")
    .eq("shop_id", shopId)
    .eq("sale_id", saleId)
    .order("collected_at");

  if (error) {
    throw error;
  }

  return ((data ?? []) as SalePaymentRow[]).map((row) => ({
    id: row.id,
    amount: row.amount,
    collected_at: row.collected_at,
    created_at: row.created_at,
    note: row.note,
    voided_at: row.voided_at,
    collected_by_name: one(row.users)?.name ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Stock adjustments
// ---------------------------------------------------------------------------

type AdjustmentRow = {
  id: string;
  quantity_change: number;
  reason: string;
  created_at: string | null;
  users: Embedded<{ name: string | null }>;
  stock_batches: Embedded<{
    batch_number: string;
    received_date: string | null;
    products: Embedded<{ product_name: string }>;
  }>;
};

export async function listAdjustments({
  supabase,
  shopId,
}: ShopContext): Promise<StockAdjustment[]> {
  const { data, error } = await supabase
    .from("stock_adjustments")
    .select(
      `
      id,
      quantity_change,
      reason,
      created_at,
      users ( name ),
      stock_batches (
        batch_number,
        received_date,
        products ( product_name )
      )
    `,
    )
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return ((data ?? []) as AdjustmentRow[]).map((row) => {
    const batch = one(row.stock_batches);

    return {
      id: row.id,
      quantity_change: row.quantity_change,
      reason: row.reason,
      created_at: row.created_at,
      batch_number: batch?.batch_number ?? null,
      batch_received_date: batch?.received_date ?? null,
      product_name: one(batch?.products ?? null)?.product_name ?? null,
      adjusted_by_name: one(row.users)?.name ?? null,
    };
  });
}

/**
 * In-stock batches across the shop, for the adjustment picker.
 *
 * `detail` carries received date, selling price and quantity because batch
 * references are not unique: two arrivals of the same product may both be
 * labelled 080826, and the reference alone would leave the owner guessing which
 * row they are about to correct. Date and price are what actually tell them
 * apart — they are the reason a second batch exists.
 */
export async function listAdjustableBatches({
  supabase,
  shopId,
}: ShopContext): Promise<
  Array<{ id: string; label: string; detail: string; quantityRemaining: number }>
> {
  const { data, error } = await supabase
    .from("stock_batches")
    .select(
      `
      id,
      batch_number,
      quantity_remaining,
      selling_price,
      received_date,
      products ( product_name )
    `,
    )
    .eq("shop_id", shopId)
    .order("received_date", { ascending: false })
    .limit(200);

  if (error) {
    throw error;
  }

  type Row = {
    id: string;
    batch_number: string;
    quantity_remaining: number;
    selling_price: string;
    received_date: string | null;
    products: Embedded<{ product_name: string }>;
  };

  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    label: `${one(row.products)?.product_name ?? "Unknown product"} — ${
      row.batch_number
    }`,
    detail: [
      // `received_date` is a date column, so formatDateKey — formatDate would
      // parse it as UTC midnight and show the previous day west of UTC.
      formatDateKey(row.received_date),
      formatCurrency(row.selling_price),
      `${row.quantity_remaining} on hand`,
    ].join(" · "),
    quantityRemaining: row.quantity_remaining,
  }));
}

// ---------------------------------------------------------------------------
// Shop settings
// ---------------------------------------------------------------------------

export type ShopSettings = {
  id: string;
  shop_name: string;
  owner_name: string | null;
  status: string | null;
  default_interest_percentage: string;
};

export async function getShopSettings({
  supabase,
  shopId,
}: ShopContext): Promise<ShopSettings | null> {
  const { data, error } = await supabase
    .from("shops")
    .select("id, shop_name, owner_name, status, default_interest_percentage")
    .eq("id", shopId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ShopSettings | null;
}

/** The shop's default markup, used to pre-fill the receive-stock form. */
export async function getDefaultInterest(
  context: ShopContext,
): Promise<number> {
  const settings = await getShopSettings(context);

  return toNumber(settings?.default_interest_percentage ?? 30);
}

// ---------------------------------------------------------------------------
// Shop members
// ---------------------------------------------------------------------------

/**
 * Everyone with a login for this shop, owner included.
 *
 * The owner is in the list rather than filtered out because the page shows how
 * many of the two assistant slots are taken, and seeing the whole team makes
 * that count make sense. `isSelf` is resolved here so the UI can refuse to let
 * an owner deactivate their own account.
 *
 * Active first, so a deactivated row cannot be mistaken for a working login.
 */
export async function listShopMembers({
  supabase,
  shopId,
  userId,
}: ShopContext): Promise<ShopMember[]> {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, role, status, created_at")
    .eq("shop_id", shopId)
    .order("status")
    .order("role")
    .order("created_at");

  if (error) {
    throw error;
  }

  return ((data ?? []) as MemberRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    created_at: row.created_at,
    isSelf: row.id === userId,
  }));
}

type MemberRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: ShopMember["role"];
  status: ShopMember["status"];
  created_at: string | null;
};
