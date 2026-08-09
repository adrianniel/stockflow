"use server";

import { revalidatePath } from "next/cache";

import { sellingPriceFrom } from "@/lib/utils/format";

import {
  databaseFailure,
  failure,
  success,
  type ActionState,
} from "./action-result";
import { getShopContext, NoShopError } from "./context";
import {
  FormErrors,
  isUuid,
  money,
  readOptionalString,
  readOptionalUuid,
  readString,
  requiredNumber,
  requiredText,
} from "./form";
import { isPaymentStatus } from "./types";

/**
 * Server actions for every shop write.
 *
 * Shared rules, applied by all of them:
 *
 *   * The acting user and their shop come from `getShopContext(...roles)`, which
 *     resolves both from the session. No action reads a shop id from its form.
 *   * Role is enforced twice: here, by the roles passed to getShopContext, and
 *     again by RLS in the database. The check here produces a decent error
 *     message; RLS is what actually protects the data if this code is wrong.
 *   * Validation failures come back as ActionState so the form can show them.
 *     Only genuinely unexpected errors are allowed to throw.
 *   * Successful writes revalidate the affected paths, because the list pages
 *     are Server Components and would otherwise serve a stale cache.
 */

/**
 * Wraps an action body so a missing shop assignment becomes a field-less error
 * rather than a 500. Everything else propagates: an unexpected throw should hit
 * the error boundary and be visible, not be flattened into a form message.
 */
async function withShop(
  run: () => Promise<ActionState>,
): Promise<ActionState> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof NoShopError) {
      return failure(error.message);
    }

    throw error;
  }
}

// ---------------------------------------------------------------------------
// Categories — OWNER only (RLS: "Owners can create/update/delete categories")
// ---------------------------------------------------------------------------

export async function createCategory(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withShop(async () => {
    const { supabase, shopId, userId } = await getShopContext("OWNER");
    const errors = new FormErrors();

    const name = requiredText(form, "name", errors, {
      label: "Category name",
      max: 100,
    });

    if (errors.hasErrors) {
      return failure("Check the highlighted field.", errors.all);
    }

    const { error } = await supabase.from("categories").insert({
      shop_id: shopId,
      name,
      created_by: userId,
    });

    if (error) {
      return databaseFailure(error, "Could not create the category.");
    }

    revalidatePath("/dashboard/categories");
    revalidatePath("/dashboard/products");

    return success(`Category "${name}" created.`);
  });
}

export async function updateCategory(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withShop(async () => {
    const { supabase, shopId } = await getShopContext("OWNER");
    const errors = new FormErrors();

    const id = readString(form, "id");
    const name = requiredText(form, "name", errors, {
      label: "Category name",
      max: 100,
    });

    if (!isUuid(id)) {
      return failure("That category could not be found.");
    }

    if (errors.hasErrors) {
      return failure("Check the highlighted field.", errors.all);
    }

    const { error } = await supabase
      .from("categories")
      .update({ name })
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) {
      return databaseFailure(error, "Could not update the category.");
    }

    revalidatePath("/dashboard/categories");
    revalidatePath("/dashboard/products");

    return success("Category updated.");
  });
}

/**
 * Deletes a category. Products that referenced it keep existing with a null
 * category — `products.category_id` is ON DELETE SET NULL, so this cannot take
 * the catalogue with it.
 */
export async function deleteCategory(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withShop(async () => {
    const { supabase, shopId } = await getShopContext("OWNER");

    const id = readString(form, "id");

    if (!isUuid(id)) {
      return failure("That category could not be found.");
    }

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) {
      return databaseFailure(error, "Could not delete the category.");
    }

    revalidatePath("/dashboard/categories");
    revalidatePath("/dashboard/products");

    return success("Category deleted.");
  });
}

// ---------------------------------------------------------------------------
// Products — OWNER only. Prices deliberately absent (SRS 6.3): they live on
// stock batches, because they change between arrivals.
// ---------------------------------------------------------------------------

export async function createProduct(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withShop(async () => {
    const { supabase, shopId, userId } = await getShopContext("OWNER");
    const errors = new FormErrors();

    const productName = requiredText(form, "product_name", errors, {
      label: "Product name",
    });
    const brand = readOptionalString(form, "brand");
    const description = readOptionalString(form, "description");
    // A category id that fails the uuid check becomes null rather than an
    // error: the field is optional, and the only way to submit a malformed one
    // is to bypass the select.
    const categoryId = readOptionalUuid(form, "category_id");

    if (errors.hasErrors) {
      return failure("Check the highlighted fields.", errors.all);
    }

    const { error } = await supabase.from("products").insert({
      shop_id: shopId,
      category_id: categoryId,
      product_name: productName,
      brand,
      description,
      created_by: userId,
    });

    if (error) {
      return databaseFailure(error, "Could not create the product.");
    }

    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/inventory");

    return success(`Product "${productName}" created.`);
  });
}

export async function updateProduct(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withShop(async () => {
    const { supabase, shopId } = await getShopContext("OWNER");
    const errors = new FormErrors();

    const id = readString(form, "id");
    const productName = requiredText(form, "product_name", errors, {
      label: "Product name",
    });
    const brand = readOptionalString(form, "brand");
    const description = readOptionalString(form, "description");
    const categoryId = readOptionalUuid(form, "category_id");

    if (!isUuid(id)) {
      return failure("That product could not be found.");
    }

    if (errors.hasErrors) {
      return failure("Check the highlighted fields.", errors.all);
    }

    const { error } = await supabase
      .from("products")
      .update({
        product_name: productName,
        brand,
        description,
        category_id: categoryId,
      })
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) {
      return databaseFailure(error, "Could not update the product.");
    }

    revalidatePath("/dashboard/products");
    revalidatePath(`/dashboard/products/${id}`);
    revalidatePath("/dashboard/inventory");

    return success("Product updated.");
  });
}

/**
 * Deletes a product.
 *
 * `stock_batches.product_id` is ON DELETE CASCADE, so this removes the
 * product's batches too — and `sale_items.stock_batch_id` is ON DELETE SET
 * NULL, so past sales survive but lose their link to the batch they came from.
 * Sale items keep their own copy of capital_price, suggested_price,
 * actual_selling_price and profit, so recorded history and reports stay
 * correct; only the traceable link back to the batch is lost. The UI warns
 * before calling this when stock is still on hand.
 */
export async function deleteProduct(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withShop(async () => {
    const { supabase, shopId } = await getShopContext("OWNER");

    const id = readString(form, "id");

    if (!isUuid(id)) {
      return failure("That product could not be found.");
    }

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) {
      return databaseFailure(error, "Could not delete the product.");
    }

    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/inventory");

    return success("Product deleted.");
  });
}

// ---------------------------------------------------------------------------
// Stock batches — OWNER and ASSISTANT (SRS 5.3: assistants log arrivals)
// ---------------------------------------------------------------------------

/**
 * Records a stock arrival as a new batch (SRS 6.4, rules 1-3).
 *
 * Always an INSERT, never an update of an existing batch: the whole point of
 * batch inventory is that an arrival at a new price becomes a new record and
 * the old price stays untouched.
 *
 * `selling_price` is derived server-side from capital price and interest rather
 * than taken from the form, even though the form shows a live preview. The
 * client's arithmetic is a convenience; the stored figure has to be the one the
 * rule produces.
 */
export async function receiveStock(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withShop(async () => {
    const { supabase, shopId, userId } = await getShopContext(
      "OWNER",
      "ASSISTANT",
    );
    const errors = new FormErrors();

    const productId = readString(form, "product_id");
    const batchNumber = requiredText(form, "batch_number", errors, {
      label: "Batch reference",
      max: 60,
    });
    const quantity = requiredNumber(form, "quantity_received", errors, {
      label: "Quantity",
      min: 1,
      max: 1_000_000,
      integer: true,
    });
    const capitalPrice = requiredNumber(form, "capital_price", errors, {
      label: "Capital price",
      min: 0,
    });
    const interest = requiredNumber(form, "interest_percentage", errors, {
      label: "Interest",
      min: 0,
      max: 1000,
    });

    if (!isUuid(productId)) {
      errors.add("product_id", "Choose a product.");
    }

    if (errors.hasErrors) {
      return failure("Check the highlighted fields.", errors.all);
    }

    // Confirms the product belongs to this shop before inserting a batch
    // against it. RLS on stock_batches checks the batch's own shop_id, not the
    // product's, so without this a valid-looking insert could attach a batch to
    // another shop's product id.
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (productError) {
      return databaseFailure(productError, "Could not verify the product.");
    }

    if (!product) {
      return failure("That product could not be found in your shop.");
    }

    const sellingPrice = sellingPriceFrom(capitalPrice, interest);

    const { error } = await supabase.from("stock_batches").insert({
      shop_id: shopId,
      product_id: productId,
      batch_number: batchNumber,
      quantity_received: quantity,
      // A new arrival starts fully in stock; sales draw it down from here.
      quantity_remaining: quantity,
      capital_price: money(capitalPrice),
      interest_percentage: interest,
      selling_price: sellingPrice,
      created_by: userId,
    });

    if (error) {
      return databaseFailure(error, "Could not record the stock arrival.");
    }

    revalidatePath("/dashboard/inventory");
    revalidatePath(`/dashboard/inventory/${productId}`);
    revalidatePath("/dashboard/products");

    return success(`Received ${quantity} unit(s) under ref ${batchNumber}.`);
  });
}

// ---------------------------------------------------------------------------
// Sales — OWNER and ASSISTANT, through the record_sale RPC
// ---------------------------------------------------------------------------

type SaleItemInput = {
  product_id: string;
  quantity: number;
  actual_selling_price?: number;
  /** Omitted to let record_sale() pick batches oldest-first. */
  stock_batch_id?: string;
};

/**
 * Records a sale.
 *
 * The batch deduction, the stock check, the profit arithmetic and the per-batch
 * sale_items rows all happen inside `record_sale()`. This function only parses
 * the cart and forwards it, because doing the deduction here would mean reading
 * remaining quantities and then writing them back — and two tills selling the
 * last units at the same time would both pass that check and oversell. The
 * function holds row locks for the length of the transaction, which is the only
 * place that race can be closed.
 *
 * A line may name the batch it comes out of. When it does not, `record_sale()`
 * falls back to FIFO. Either way the server decides what is deducted; a batch
 * id here is a request, and it is checked against the shop and the product
 * before anything is taken from it.
 *
 * The cart arrives as JSON in one field rather than as indexed form fields,
 * since it is built up client-side and its length varies.
 */
export async function recordSale(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withShop(async () => {
    const { supabase } = await getShopContext("OWNER", "ASSISTANT");

    const paymentStatus = readString(form, "payment_status") || "PAID";

    if (!isPaymentStatus(paymentStatus)) {
      return failure("Choose a valid payment status.");
    }

    const rawItems = readString(form, "items");

    if (rawItems === "") {
      return failure("Add at least one item to the sale.");
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(rawItems);
    } catch {
      return failure("The sale could not be read. Please try again.");
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return failure("Add at least one item to the sale.");
    }

    const items: SaleItemInput[] = [];

    for (const entry of parsed) {
      if (typeof entry !== "object" || entry === null) {
        return failure("One of the sale lines is invalid.");
      }

      const line = entry as Record<string, unknown>;
      const productId = typeof line.productId === "string" ? line.productId : "";
      const quantity = Number(line.quantity);

      if (!isUuid(productId)) {
        return failure("One of the sale lines has an invalid product.");
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return failure("Every quantity must be a whole number above zero.");
      }

      const item: SaleItemInput = { product_id: productId, quantity };

      // Optional. An absent or blank batch means "whatever FIFO picks", which
      // is what an older client sends and what the till sends when the product
      // has nothing to choose between. A malformed one is rejected rather than
      // dropped: silently falling back to FIFO would deduct a different batch
      // than the user was shown, at a different capital price.
      const batchId = line.stockBatchId;

      if (batchId !== null && batchId !== undefined && batchId !== "") {
        if (typeof batchId !== "string" || !isUuid(batchId)) {
          return failure("One of the sale lines has an invalid batch.");
        }

        item.stock_batch_id = batchId;
      }

      // Only sent when the user actually overrode the price. A discount below
      // capital price is permitted and records a real loss (SRS 10), so the
      // only bound here is that it cannot be negative.
      const override = line.actualSellingPrice;

      if (override !== null && override !== undefined && override !== "") {
        const price = Number(override);

        if (!Number.isFinite(price) || price < 0) {
          return failure("An adjusted price is not a valid amount.");
        }

        item.actual_selling_price = money(price);
      }

      items.push(item);
    }

    // Only PARTIAL carries an amount; record_sale() derives the other two from
    // the computed total, which the client does not know reliably.
    let amountPaid: number | null = null;

    if (paymentStatus === "PARTIAL") {
      const errors = new FormErrors();
      const value = requiredNumber(form, "amount_paid", errors, {
        label: "Amount paid",
        min: 0.01,
      });

      if (errors.hasErrors) {
        return failure("Check the highlighted field.", errors.all);
      }

      amountPaid = money(value);
    }

    // A debt needs someone attached to it, or the shop has no way to collect it
    // later. record_sale() enforces this too — this check exists to name the
    // field rather than surface a database exception.
    const customerId = readOptionalUuid(form, "customer_id");

    if (paymentStatus !== "PAID" && customerId === null) {
      return failure("Choose a customer for a credit or partial sale.", {
        customer_id: "Select who owes for this sale.",
      });
    }

    const { data, error } = await supabase.rpc("record_sale", {
      p_items: items,
      p_payment_status: paymentStatus,
      p_amount_paid: amountPaid,
      p_customer_id: customerId,
    });

    if (error) {
      // Out-of-stock and permission problems arrive as RAISE EXCEPTION text
      // written for the user, so databaseFailure passes them through.
      return databaseFailure(error, "Could not record the sale.");
    }

    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/reports");
    // The day-detail route separately: revalidating the parent path does not
    // reach its children, and the sale just recorded belongs to one of them.
    // The segment form drops every date at once, which is right — we would
    // otherwise have to know which local day the server filed it under.
    revalidatePath("/dashboard/reports/[date]", "page");
    revalidatePath("/dashboard/owner");
    revalidatePath("/dashboard/assistant");

    return success(
      typeof data === "string" ? `Sale recorded (${data.slice(0, 8)}).` : "Sale recorded.",
    );
  });
}

/**
 * Voids a live sale and records its replacement in one database transaction.
 * The database function owns the batch restoration/deduction and payment
 * ledger work; this action only validates the form and forwards the cart.
 */
export async function amendSale(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withShop(async () => {
    const { supabase } = await getShopContext("OWNER");
    const errors = new FormErrors();
    const saleId = readString(form, "sale_id");
    const reason = requiredText(form, "amendment_reason", errors, {
      label: "Reason",
      max: 300,
    });

    if (!isUuid(saleId)) {
      return failure("That sale could not be found.");
    }

    const paymentStatus = readString(form, "payment_status") || "PAID";

    if (!isPaymentStatus(paymentStatus)) {
      return failure("Choose a valid payment status.");
    }

    const rawItems = readString(form, "items");

    if (rawItems === "") {
      return failure("Add at least one item to the replacement sale.");
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(rawItems);
    } catch {
      return failure("The replacement sale could not be read. Please try again.");
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return failure("Add at least one item to the replacement sale.");
    }

    const items: SaleItemInput[] = [];

    for (const entry of parsed) {
      if (typeof entry !== "object" || entry === null) {
        return failure("One of the replacement lines is invalid.");
      }

      const line = entry as Record<string, unknown>;
      const productId = typeof line.productId === "string" ? line.productId : "";
      const quantity = Number(line.quantity);

      if (!isUuid(productId)) {
        return failure("One of the replacement lines has an invalid product.");
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return failure("Every quantity must be a whole number above zero.");
      }

      const item: SaleItemInput = { product_id: productId, quantity };
      const batchId = line.stockBatchId;

      if (batchId !== null && batchId !== undefined && batchId !== "") {
        if (typeof batchId !== "string" || !isUuid(batchId)) {
          return failure("One of the replacement lines has an invalid batch.");
        }

        item.stock_batch_id = batchId;
      }

      const override = line.actualSellingPrice;

      if (override !== null && override !== undefined && override !== "") {
        const price = Number(override);

        if (!Number.isFinite(price) || price < 0) {
          return failure("An adjusted price is not a valid amount.");
        }

        item.actual_selling_price = money(price);
      }

      items.push(item);
    }

    let amountPaid: number | null = null;

    if (paymentStatus === "PARTIAL") {
      const value = requiredNumber(form, "amount_paid", errors, {
        label: "Amount paid",
        min: 0.01,
      });

      if (errors.hasErrors) {
        return failure("Check the highlighted field.", errors.all);
      }

      amountPaid = money(value);
    }

    const customerId = readOptionalUuid(form, "customer_id");

    if (paymentStatus !== "PAID" && customerId === null) {
      return failure("Choose a customer for a credit or partial replacement.", {
        customer_id: "Select who owes for this replacement sale.",
      });
    }

    if (errors.hasErrors) {
      return failure("Check the highlighted fields.", errors.all);
    }

    const { data, error } = await supabase.rpc("amend_sale", {
      p_sale_id: saleId,
      p_reason: reason,
      p_items: items,
      p_payment_status: paymentStatus,
      p_amount_paid: amountPaid,
      p_customer_id: customerId,
    });

    if (error) {
      return databaseFailure(error, "Could not amend this sale.");
    }

    const replacementId = typeof data === "string" ? data : null;

    revalidatePath("/dashboard/sales");
    revalidatePath(`/dashboard/sales/${saleId}`);
    if (replacementId) {
      revalidatePath(`/dashboard/sales/${replacementId}`);
    }
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/adjustments");
    revalidatePath("/dashboard/credit");
    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard/reports/[date]", "page");
    revalidatePath("/dashboard/owner");
    revalidatePath("/dashboard/assistant");

    return success("Sale amended. The original remains in history.", replacementId ?? undefined);
  });
}

// ---------------------------------------------------------------------------
// Customers and credit collection
// ---------------------------------------------------------------------------

/**
 * Adds a credit customer.
 *
 * Open to assistants, matching the RLS policy. The reasoning is in
 * 20260801120900: an assistant who cannot add a customer mid-sale will record
 * the utang as a cash sale instead, and the debt disappears from the books.
 * Renaming and deleting stay owner-only.
 */
export async function createCustomer(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withShop(async () => {
    const { supabase, shopId, userId } = await getShopContext(
      "OWNER",
      "ASSISTANT",
    );
    const errors = new FormErrors();

    const name = requiredText(form, "name", errors, {
      label: "Customer name",
      max: 120,
    });
    const phone = readOptionalString(form, "phone");
    const notes = readOptionalString(form, "notes");

    if (phone !== null && phone.length > 40) {
      errors.add("phone", "Phone number must be 40 characters or fewer.");
    }

    if (notes !== null && notes.length > 500) {
      errors.add("notes", "Notes must be 500 characters or fewer.");
    }

    if (errors.hasErrors) {
      return failure("Check the highlighted fields.", errors.all);
    }

    const { error } = await supabase.from("customers").insert({
      shop_id: shopId,
      name,
      phone,
      notes,
      created_by: userId,
    });

    if (error) {
      // customers_shop_name_key. Reported against the field so the form can
      // point at it, rather than as a bare "duplicate key" from Postgres.
      if (error.code === "23505") {
        return failure(`"${name}" is already in your customer list.`, {
          name: "This name is already taken.",
        });
      }

      return databaseFailure(error, "Could not add the customer.");
    }

    revalidatePath("/dashboard/credit");
    revalidatePath("/dashboard/sales/new");

    return success(`${name} added.`);
  });
}

export async function updateCustomer(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withShop(async () => {
    const { supabase, shopId } = await getShopContext("OWNER");
    const errors = new FormErrors();

    const id = readString(form, "id");
    const name = requiredText(form, "name", errors, {
      label: "Customer name",
      max: 120,
    });
    const phone = readOptionalString(form, "phone");
    const notes = readOptionalString(form, "notes");

    if (!isUuid(id)) {
      return failure("That customer could not be found.");
    }

    if (errors.hasErrors) {
      return failure("Check the highlighted fields.", errors.all);
    }

    const { error } = await supabase
      .from("customers")
      .update({ name, phone, notes })
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) {
      if (error.code === "23505") {
        return failure(`"${name}" is already in your customer list.`, {
          name: "This name is already taken.",
        });
      }

      return databaseFailure(error, "Could not update the customer.");
    }

    revalidatePath("/dashboard/credit");
    revalidatePath(`/dashboard/credit/${id}`);

    return success("Customer updated.");
  });
}

/**
 * Deletes a customer.
 *
 * Refused while they still owe money — `sales.customer_id` is ON DELETE SET
 * NULL, so deleting a debtor would leave their unpaid sales in the books with
 * nobody attached, and the shop would lose track of the debt rather than
 * cancelling it. Settle or write off the balance first.
 */
export async function deleteCustomer(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withShop(async () => {
    const { supabase, shopId } = await getShopContext("OWNER");

    const id = readString(form, "id");

    if (!isUuid(id)) {
      return failure("That customer could not be found.");
    }

    const { data: unpaid, error: unpaidError } = await supabase
      .from("sales")
      .select("id")
      .eq("shop_id", shopId)
      .eq("customer_id", id)
      .neq("payment_status", "PAID")
      // A voided sale reads as CREDIT with nothing paid. Counting it here would
      // block the customer from ever being removed over a debt that was
      // cancelled.
      .is("voided_at", null)
      .limit(1);

    if (unpaidError) {
      return databaseFailure(unpaidError, "Could not check the balance.");
    }

    if ((unpaid ?? []).length > 0) {
      return failure(
        "This customer still has unpaid sales. Collect or settle them before removing the customer.",
      );
    }

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) {
      return databaseFailure(error, "Could not remove the customer.");
    }

    revalidatePath("/dashboard/credit");

    return success("Customer removed.");
  });
}

/**
 * Records an instalment against a sale.
 *
 * All of the work is in `record_payment()`: it locks the sale row, checks the
 * amount against the outstanding balance, and lets a trigger recompute
 * `amount_paid` and `payment_status` from the ledger. Doing it here instead
 * would mean reading the balance and then writing it back, and two clerks
 * accepting the last of a debt at once would both pass that check.
 *
 * Open to assistants: they are usually the person the cash is handed to.
 */
export async function recordPayment(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withShop(async () => {
    const { supabase } = await getShopContext("OWNER", "ASSISTANT");
    const errors = new FormErrors();

    const saleId = readString(form, "sale_id");
    const amount = requiredNumber(form, "amount", errors, {
      label: "Amount",
      min: 0.01,
    });
    const note = readOptionalString(form, "note");
    const collectedAtRaw = readString(form, "collected_at");
    let collectedAt: string | null = null;

    if (collectedAtRaw !== "") {
      const parsed = new Date(collectedAtRaw);

      if (Number.isNaN(parsed.getTime())) {
        errors.add("collected_at", "Enter a valid payment date and time.");
      } else if (parsed.getTime() > Date.now() + 60_000) {
        errors.add("collected_at", "The received date and time cannot be in the future.");
      } else {
        collectedAt = parsed.toISOString();
      }
    }

    // Only used to revalidate the page the payment was taken on. Not trusted
    // for anything else: `record_payment()` derives the shop and the customer
    // from the sale itself, so a forged id here changes nothing but which
    // cache entry is dropped.
    const customerId = readOptionalUuid(form, "customer_id");

    if (!isUuid(saleId)) {
      return failure("That sale could not be found.");
    }

    if (note !== null && note.length > 200) {
      errors.add("note", "Note must be 200 characters or fewer.");
    }

    if (errors.hasErrors) {
      return failure("Check the highlighted fields.", errors.all);
    }

    const { error } = await supabase.rpc("record_payment", {
      p_sale_id: saleId,
      p_amount: money(amount),
      p_collected_at: collectedAt,
      p_note: note,
    });

    if (error) {
      // "Payment of X exceeds the outstanding balance of Y" and friends are
      // RAISE EXCEPTION text written for the user, so it passes through.
      return databaseFailure(error, "Could not record the payment.");
    }

    revalidatePath("/dashboard/credit");
    revalidatePath("/dashboard/sales");
    revalidatePath(`/dashboard/sales/${saleId}`);

    // The customer page the collection was taken on, when the form sent one.
    if (customerId !== null) {
      revalidatePath(`/dashboard/credit/${customerId}`);
    }

    revalidatePath("/dashboard/reports");
    // Two days can be affected — the day the money came in and the day the sale
    // was originally made — so the whole segment is dropped rather than guessed
    // at. See the note in recordSale.
    revalidatePath("/dashboard/reports/[date]", "page");
    revalidatePath("/dashboard/owner");
    revalidatePath("/dashboard/assistant");

    return success("Payment recorded.");
  });
}

type VoidResult = {
  restored_units: number;
  restored_batches: number;
  orphan_lines: number;
  voided_payments: number;
};

/**
 * Cancels a recorded sale without deleting it.
 *
 * Everything of consequence happens in `void_sale()`: the sale row is locked,
 * its batches are locked in id order, the stock goes back with a
 * `stock_adjustments` row per batch to say why, and the payments are marked
 * voided so the recompute trigger takes them out of `amount_paid`. Splitting
 * that across PostgREST calls would leave a window where stock had been
 * returned but the sale still counted, or the reverse.
 *
 * Owner-only, unlike recording a sale or taking a payment. An assistant at the
 * counter should be able to record what happens; undoing a recorded transaction
 * is the owner's call. `void_sale()` enforces the same rule itself, so this
 * check is only here to produce a readable message.
 */
export async function voidSale(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withShop(async () => {
    const { supabase } = await getShopContext("OWNER");
    const errors = new FormErrors();

    const saleId = readString(form, "sale_id");
    const reason = requiredText(form, "void_reason", errors, {
      label: "Reason",
      max: 300,
    });

    if (!isUuid(saleId)) {
      return failure("That sale could not be found.");
    }

    if (errors.hasErrors) {
      return failure("Check the highlighted fields.", errors.all);
    }

    const { data, error } = await supabase.rpc("void_sale", {
      p_sale_id: saleId,
      p_reason: reason,
    });

    if (error) {
      // "Returning 5 unit(s) to batch 080826 would leave it holding..." and
      // "This sale was already voided" are RAISE EXCEPTION text written for the
      // user, so they pass through unchanged.
      return databaseFailure(error, "Could not void this sale.");
    }

    revalidatePath("/dashboard/sales");
    revalidatePath(`/dashboard/sales/${saleId}`);
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/adjustments");
    revalidatePath("/dashboard/credit");
    revalidatePath("/dashboard/reports");
    // The sale's own day and every day it was collected on can all change, so
    // the whole segment is dropped rather than guessed at. See recordSale.
    revalidatePath("/dashboard/reports/[date]", "page");
    revalidatePath("/dashboard/owner");
    revalidatePath("/dashboard/assistant");

    return success(voidMessage(data as VoidResult | null));
  });
}

/**
 * Says what the void actually did, rather than only that it worked.
 *
 * The units restored are the number worth reading back — it is the figure the
 * owner can check against the shelf. Lines whose batch no longer exists are
 * called out separately, because that stock cannot come back and the shop needs
 * to know it has to correct those by hand.
 */
function voidMessage(result: VoidResult | null): string {
  if (result === null) {
    return "Sale voided.";
  }

  const parts = ["Sale voided."];

  if (result.restored_units > 0) {
    const units = result.restored_units === 1 ? "unit" : "units";
    const batches = result.restored_batches === 1 ? "batch" : "batches";

    parts.push(
      `${result.restored_units} ${units} returned to ${result.restored_batches} ${batches}.`,
    );
  }

  if (result.orphan_lines > 0) {
    const lines = result.orphan_lines === 1 ? "line" : "lines";

    parts.push(
      `${result.orphan_lines} ${lines} could not be restored because the batch no longer exists — adjust that stock manually.`,
    );
  }

  if (result.voided_payments > 0) {
    const payments = result.voided_payments === 1 ? "payment" : "payments";

    parts.push(
      `${result.voided_payments} ${payments} kept on the sale for history but no longer counted.`,
    );
  }

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Stock adjustments — OWNER only (SRS 13)
// ---------------------------------------------------------------------------

/**
 * Corrects a batch's remaining quantity and records why (SRS 13).
 *
 * Two writes that ought to be one transaction: the adjustment row and the new
 * quantity. PostgREST cannot express that, so the adjustment is written first —
 * if the quantity update then fails, the shop is left with a logged reason and
 * unchanged stock, which is visible and fixable. The reverse order could change
 * stock with no record of who did it or why, which is exactly what this feature
 * exists to prevent.
 *
 * A negative change cannot take a batch below zero; the check happens against
 * the freshly-read quantity here, and the column's own CHECK is the backstop.
 */
export async function adjustStock(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withShop(async () => {
    const { supabase, shopId, userId } = await getShopContext("OWNER");
    const errors = new FormErrors();

    const batchId = readString(form, "stock_batch_id");
    const quantityChange = requiredNumber(form, "quantity_change", errors, {
      label: "Quantity change",
      min: -1_000_000,
      max: 1_000_000,
      integer: true,
    });
    const reason = requiredText(form, "reason", errors, {
      label: "Reason",
      max: 300,
    });

    if (!isUuid(batchId)) {
      errors.add("stock_batch_id", "Choose a batch.");
    }

    if (quantityChange === 0) {
      errors.add(
        "quantity_change",
        "Enter how many units to add or remove, not zero.",
      );
    }

    if (errors.hasErrors) {
      return failure("Check the highlighted fields.", errors.all);
    }

    const { data: batch, error: batchError } = await supabase
      .from("stock_batches")
      .select("id, quantity_remaining")
      .eq("id", batchId)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (batchError) {
      return databaseFailure(batchError, "Could not load the batch.");
    }

    if (!batch) {
      return failure("That batch could not be found in your shop.");
    }

    const nextQuantity = batch.quantity_remaining + quantityChange;

    if (nextQuantity < 0) {
      return failure(
        `That would leave ${nextQuantity} units. The batch only has ${batch.quantity_remaining} on hand.`,
        { quantity_change: "More than the batch holds." },
      );
    }

    const { error: adjustmentError } = await supabase
      .from("stock_adjustments")
      .insert({
        shop_id: shopId,
        stock_batch_id: batchId,
        quantity_change: quantityChange,
        reason,
        adjusted_by: userId,
      });

    if (adjustmentError) {
      return databaseFailure(
        adjustmentError,
        "Could not record the adjustment.",
      );
    }

    const { error: updateError } = await supabase
      .from("stock_batches")
      .update({ quantity_remaining: nextQuantity })
      .eq("id", batchId)
      .eq("shop_id", shopId);

    if (updateError) {
      return databaseFailure(
        updateError,
        "The adjustment was logged but the stock count did not change. Please check the batch.",
      );
    }

    revalidatePath("/dashboard/adjustments");
    revalidatePath("/dashboard/inventory");

    return success("Stock adjusted.");
  });
}

// ---------------------------------------------------------------------------
// Shop settings — OWNER only
// ---------------------------------------------------------------------------

/**
 * Updates shop details and the default markup.
 *
 * Changing the default does not touch existing batches: each batch keeps the
 * rate it was priced with, so historical prices and profit stay as they were.
 */
export async function updateShopSettings(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withShop(async () => {
    const { supabase, shopId } = await getShopContext("OWNER");
    const errors = new FormErrors();

    const shopName = requiredText(form, "shop_name", errors, {
      label: "Shop name",
      max: 150,
    });
    const ownerName = readOptionalString(form, "owner_name");
    const interest = requiredNumber(form, "default_interest_percentage", errors, {
      label: "Default interest",
      min: 0,
      max: 1000,
    });

    if (errors.hasErrors) {
      return failure("Check the highlighted fields.", errors.all);
    }

    const { error } = await supabase
      .from("shops")
      .update({
        shop_name: shopName,
        owner_name: ownerName,
        default_interest_percentage: interest,
      })
      .eq("id", shopId);

    if (error) {
      return databaseFailure(error, "Could not save your shop settings.");
    }

    revalidatePath("/dashboard/settings");

    return success("Shop settings saved.");
  });
}
