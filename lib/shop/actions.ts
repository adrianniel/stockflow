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
      label: "Batch number",
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

    return success(`Received ${quantity} unit(s) as batch ${batchNumber}.`);
  });
}

// ---------------------------------------------------------------------------
// Sales — OWNER and ASSISTANT, through the record_sale RPC
// ---------------------------------------------------------------------------

type SaleItemInput = {
  product_id: string;
  quantity: number;
  actual_selling_price?: number;
};

/**
 * Records a sale.
 *
 * The FIFO deduction, the stock check, the profit arithmetic and the per-batch
 * sale_items rows all happen inside `record_sale()`. This function only parses
 * the cart and forwards it, because doing the deduction here would mean reading
 * remaining quantities and then writing them back — and two tills selling the
 * last units at the same time would both pass that check and oversell. The
 * function holds row locks for the length of the transaction, which is the only
 * place that race can be closed.
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

    const { data, error } = await supabase.rpc("record_sale", {
      p_items: items,
      p_payment_status: paymentStatus,
      p_amount_paid: amountPaid,
    });

    if (error) {
      // Out-of-stock and permission problems arrive as RAISE EXCEPTION text
      // written for the user, so databaseFailure passes them through.
      return databaseFailure(error, "Could not record the sale.");
    }

    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard/owner");
    revalidatePath("/dashboard/assistant");

    return success(
      typeof data === "string" ? `Sale recorded (${data.slice(0, 8)}).` : "Sale recorded.",
    );
  });
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
