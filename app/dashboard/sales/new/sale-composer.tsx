"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { FormAlert, SubmitButton, fieldError } from "@/components/ui/form-status";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { IDLE, type ActionState } from "@/lib/shop/action-result";
import { recordSale } from "@/lib/shop/actions";
import type {
  CartLine,
  Customer,
  InventoryLine,
  PaymentStatus,
  SellableBatch,
} from "@/lib/shop/types";
import { formatCurrency, formatDateKey } from "@/lib/utils/format";

/**
 * The till: build a cart, adjust prices, take payment.
 *
 * A cart line is one product out of one batch. The batch is chosen for the user
 * when there is only one in stock, and offered when there is more than one —
 * pre-selected on the oldest, so the default sale deducts exactly what FIFO
 * would have deducted anyway and the fast path stays one tap.
 *
 * Selling more than one batch holds means adding the product again on the next
 * batch. That is deliberate rather than a limitation: the two halves come out
 * at different capital prices, so they are two lines of profit, and the user
 * should see that before agreeing a price rather than after.
 *
 * The totals here are an estimate and the code says so where it matters. The
 * real figures come from `record_sale()`, which re-reads the batches under row
 * locks — the quantities on this page were true at page load and nothing keeps
 * them fresh. Showing an estimate is right for the customer conversation;
 * storing one would be wrong, so nothing computed here is submitted.
 *
 * What is submitted is the cart: product ids, batch ids, quantities, and any
 * price override. The server derives everything else.
 */
export function SaleComposer({
  products,
  customers,
  initialLines = [],
  initialCustomerId = "",
  initialPaymentStatus = "PAID",
  initialAmountPaid,
  action = recordSale,
  mode = "new",
  originalSaleId,
}: {
  products: InventoryLine[];
  customers: Customer[];
  initialLines?: CartLine[];
  initialCustomerId?: string;
  initialPaymentStatus?: PaymentStatus;
  initialAmountPaid?: string | number;
  action?: (previous: ActionState, form: FormData) => Promise<ActionState>;
  mode?: "new" | "amend";
  originalSaleId?: string;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<CartLine[]>(initialLines);
  const [search, setSearch] = useState("");
  /**
   * The product whose batches are on screen, or null when none is being picked.
   *
   * Only ever set for products with more than one batch in stock — with a
   * single batch there is nothing to choose, so the line is added outright.
   */
  const [pendingProduct, setPendingProduct] = useState<InventoryLine | null>(
    null,
  );
  const [paymentStatus, setPaymentStatus] =
    useState<PaymentStatus>(initialPaymentStatus);
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [state, formAction] = useActionState(action, IDLE);

  // Cleared after a successful sale so the next customer starts fresh.
  //
  // Done during render rather than in an effect. `useActionState` hands back a
  // new state object per dispatch, so comparing against the last one handled is
  // enough to detect a fresh result — and adjusting state during render is the
  // pattern React documents for exactly this, avoiding the extra
  // commit-then-rerender pass an effect would cost.
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);

    if (state.status === "success") {
      if (mode === "amend" && state.data) {
        router.push(`/dashboard/sales/${state.data}`);
      }

      setLines([]);
      setSearch("");
      setPendingProduct(null);
      setPaymentStatus("PAID");
      setCustomerId("");
    }
  }

  // The refresh stays in an effect because it is a side effect, not a state
  // adjustment: quantities on this page came from the server and are now stale.
  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state, router, mode]);

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (term === "") {
      return [];
    }

    return products
      .filter(
        (product) =>
          product.productName.toLowerCase().includes(term) ||
          (product.brand ?? "").toLowerCase().includes(term),
      )
      .slice(0, 8);
  }, [products, search]);

  function selectProduct(product: InventoryLine) {
    // One batch is not a choice. Anything else gets the picker, already sitting
    // on the oldest batch.
    if (product.batches.length === 1) {
      addBatch(product, product.batches[0]);
      return;
    }

    setPendingProduct(product);
  }

  function addBatch(product: InventoryLine, batch: SellableBatch) {
    setLines((current) => {
      const existing = current.find((line) => line.stockBatchId === batch.id);

      // Re-adding the same batch bumps its quantity rather than creating a
      // second line, but never past what that batch holds. The same product on
      // a *different* batch is a separate line — that is how a quantity larger
      // than any one batch gets sold.
      if (existing) {
        return current.map((line) =>
          line.stockBatchId === batch.id
            ? {
                ...line,
                quantity: Math.min(line.quantity + 1, line.quantityAvailable),
              }
            : line,
        );
      }

      return [
        ...current,
        {
          productId: product.productId,
          productName: product.productName,
          stockBatchId: batch.id,
          batchNumber: batch.batchNumber,
          batchReceivedDate: batch.receivedDate,
          quantity: 1,
          actualSellingPrice: null,
          suggestedPrice: batch.sellingPrice,
          quantityAvailable: batch.quantityRemaining,
        },
      ];
    });

    setSearch("");
    setPendingProduct(null);
  }

  function updateLine(stockBatchId: string, changes: Partial<CartLine>) {
    setLines((current) =>
      current.map((line) =>
        line.stockBatchId === stockBatchId ? { ...line, ...changes } : line,
      ),
    );
  }

  function removeLine(stockBatchId: string) {
    setLines((current) =>
      current.filter((line) => line.stockBatchId !== stockBatchId),
    );
  }

  const estimatedTotal = lines.reduce(
    (total, line) =>
      total + line.quantity * (line.actualSellingPrice ?? line.suggestedPrice),
    0,
  );

  const hasLines = lines.length > 0;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {mode === "amend" && originalSaleId ? (
        <input type="hidden" name="sale_id" value={originalSaleId} />
      ) : null}
      {/* The cart travels as one JSON field: its length varies, and the server
          parses and re-validates every entry regardless of what arrives. */}
      <input type="hidden" name="items" value={JSON.stringify(lines)} />
      <input type="hidden" name="payment_status" value={paymentStatus} />
      {/* Only sent for credit and partial: a cash walk-in has no customer, and
          sending a stale id after switching back to Paid would attach a debtor
          to a settled sale. */}
      {paymentStatus !== "PAID" ? (
        <input type="hidden" name="customer_id" value={customerId} />
      ) : null}

      {mode === "amend" ? (
        <Panel>
          <PanelHeader
            title="Amend recorded sale"
            description="Saving will void the original sale and create this replacement atomically. The original remains in history."
          />
          <Field
            label="Amendment reason"
            htmlFor="amendment-reason"
            error={fieldError(state, "amendment_reason")}
            hint="Required for the audit trail."
          >
            <Input
              id="amendment-reason"
              name="amendment_reason"
              maxLength={300}
              placeholder="e.g. corrected quantity"
              required
            />
          </Field>
          <p className="mt-3 text-xs text-amber-700">
            Existing payments will remain on the original as voided history.
            The replacement starts a new payment entry; refunds and
            overpayments are not handled here.
          </p>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader
          title="Add products"
          description="Search by product name or brand. Only products with stock on hand appear."
        />

        {pendingProduct ? (
          <BatchPicker
            product={pendingProduct}
            onPick={(batch) => addBatch(pendingProduct, batch)}
            onCancel={() => setPendingProduct(null)}
          />
        ) : (
          <ProductSearch
            search={search}
            onSearchChange={setSearch}
            matches={matches}
            onSelect={selectProduct}
            hasProducts={products.length > 0}
          />
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Sale items"
          description="Adjust the price per line to give a discount. Profit is calculated from what you actually charge."
        />

        {hasLines ? (
          <div className="space-y-3">
            {lines.map((line) => (
              <CartRow
                key={line.stockBatchId}
                line={line}
                onChange={(changes) => updateLine(line.stockBatchId, changes)}
                onRemove={() => removeLine(line.stockBatchId)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No items yet"
            description="Search for a product above to start this sale."
          />
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Payment"
          description="Estimated total. The exact figure is calculated when the sale is saved, from the batches actually used."
        />

        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Estimated total
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                {formatCurrency(estimatedTotal)}
              </p>
            </div>

            <p className="text-sm text-slate-500">
              {lines.reduce((count, line) => count + line.quantity, 0)} unit(s)
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Payment status"
              htmlFor="payment-status"
              hint="Credit records the sale as fully unpaid."
            >
              <Select
                id="payment-status"
                value={paymentStatus}
                onChange={(event) =>
                  setPaymentStatus(event.target.value as PaymentStatus)
                }
              >
                <option value="PAID">Paid in full</option>
                <option value="PARTIAL">Partial payment</option>
                <option value="CREDIT">Credit (unpaid)</option>
              </Select>
            </Field>

            {paymentStatus === "PARTIAL" ? (
              <Field
                label="Amount paid"
                htmlFor="amount-paid"
                error={fieldError(state, "amount_paid")}
                hint="Must be more than zero and less than the total."
              >
                <Input
                  id="amount-paid"
                  name="amount_paid"
                  type="number"
                  min={0.01}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  defaultValue={initialAmountPaid}
                  required
                />
              </Field>
            ) : null}

            {paymentStatus !== "PAID" ? (
              <Field
                label="Customer"
                htmlFor="sale-customer"
                error={fieldError(state, "customer_id")}
                hint={
                  customers.length > 0
                    ? "Who owes for this sale. Type to search."
                    : "Add a customer on the Credit page first."
                }
              >
                {/* Remounts when the payment status changes so a customer
                    picked, then abandoned by switching to Paid and back, does
                    not linger in the box while `customerId` reads empty. */}
                <Combobox
                  key={paymentStatus}
                  id="sale-customer"
                  options={customers.map((customer) => ({
                    value: customer.id,
                    label: customer.name,
                  }))}
                  defaultValue={customerId}
                  placeholder="Select a customer"
                  emptyLabel="No matching customer"
                  disabled={customers.length === 0}
                  invalid={Boolean(fieldError(state, "customer_id"))}
                  onValueChange={setCustomerId}
                />
              </Field>
            ) : null}
          </div>

          <FormAlert state={state} />

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setLines([])}
              disabled={!hasLines}
            >
              Clear sale
            </Button>

            <SaleSubmit
              disabled={!hasLines || (paymentStatus !== "PAID" && customerId === "")}
              label={mode === "amend" ? "Save amendment" : "Record sale"}
            />
          </div>
        </div>
      </Panel>
    </form>
  );
}

/**
 * Wraps SubmitButton so the disabled state survives `useFormStatus`.
 *
 * SubmitButton disables itself while pending; this adds "and also when the cart
 * is empty", which the button itself has no way to know.
 */
function SaleSubmit({
  disabled,
  label,
}: {
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <Button type="button" disabled>
        {label}
      </Button>
    );
  }

  return (
    <SubmitButton pendingLabel={label === "Record sale" ? "Recording..." : "Saving..."}>
      {label}
    </SubmitButton>
  );
}

function ProductSearch({
  search,
  onSearchChange,
  matches,
  onSelect,
  hasProducts,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  matches: InventoryLine[];
  onSelect: (product: InventoryLine) => void;
  hasProducts: boolean;
}) {
  if (!hasProducts) {
    return (
      <EmptyState
        title="Nothing in stock"
        description="Record a stock arrival before making a sale — there is nothing to sell yet."
      />
    );
  }

  return (
    <div className="space-y-3">
      <label htmlFor="sale-search" className="sr-only">
        Search products
      </label>
      <Input
        id="sale-search"
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search products to add"
        autoComplete="off"
        // Enter would otherwise submit the enclosing form straight from the
        // search box, recording the sale mid-build.
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();

            if (matches.length === 1) {
              onSelect(matches[0]);
            }
          }
        }}
      />

      {search.trim() !== "" ? (
        matches.length > 0 ? (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
            {matches.map((product) => (
              <li key={product.productId}>
                <button
                  type="button"
                  onClick={() => onSelect(product)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <span>
                    <span className="block text-sm font-medium text-slate-950">
                      {product.productName}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {product.brand ? `${product.brand} · ` : ""}
                      {product.quantityOnHand} in stock
                      {/* Says a picker is coming, so the extra tap is expected
                          rather than a surprise. One batch adds straight to the
                          cart and needs no warning. */}
                      {product.batches.length > 1
                        ? ` · ${product.batches.length} batches`
                        : ""}
                    </span>
                  </span>

                  <span className="text-sm font-medium text-slate-700">
                    {product.currentSellingPrice === null
                      ? "—"
                      : formatCurrency(product.currentSellingPrice)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-1 text-sm text-slate-500">
            No product in stock matches &ldquo;{search}&rdquo;.
          </p>
        )
      ) : null}
    </div>
  );
}

/**
 * The batches of one product, for the user to pick which one leaves the shelf.
 *
 * `product.batches` arrives oldest-first from the query, so the first entry is
 * the one `record_sale()` would have taken on its own. It is badged and focused
 * on mount: pressing Enter therefore reproduces the old FIFO behaviour exactly,
 * and choosing anything else is a deliberate act.
 *
 * Every batch shows its reference, received date, quantity and selling price.
 * References are free-form and may repeat between arrivals, so the reference on
 * its own is not enough to tell two rows apart.
 */
function BatchPicker({
  product,
  onPick,
  onCancel,
}: {
  product: InventoryLine;
  onPick: (batch: SellableBatch) => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-950">{product.productName}</p>
          <p className="text-xs text-slate-500">
            {product.brand ? `${product.brand} · ` : ""}
            Choose the batch this sale comes out of
          </p>
        </div>

        <Button variant="ghost" size="sm" onClick={onCancel}>
          Back to search
        </Button>
      </div>

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
        {product.batches.map((batch, index) => (
          <li key={batch.id}>
            <button
              type="button"
              // Only the first: autoFocus on every row would leave focus on the
              // last one rendered, which is the newest batch — the opposite of
              // the FIFO default.
              autoFocus={index === 0}
              onClick={() => onPick(batch)}
              className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-left transition hover:bg-slate-50"
            >
              <span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-950">
                    Ref {batch.batchNumber}
                  </span>
                  {index === 0 ? <Badge>Oldest</Badge> : null}
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  Received {formatDateKey(batch.receivedDate)} ·{" "}
                  {batch.quantityRemaining} available
                </span>
              </span>

              <span className="text-sm font-medium text-slate-700">
                {formatCurrency(batch.sellingPrice)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="px-1 text-xs text-slate-500">
        Selling more than one batch holds? Add the product again and pick the
        next batch — each batch is its own line, at its own cost.
      </p>
    </div>
  );
}

function CartRow({
  line,
  onChange,
  onRemove,
}: {
  line: CartLine;
  onChange: (changes: Partial<CartLine>) => void;
  onRemove: () => void;
}) {
  /**
   * What the quantity box is showing mid-edit, or null when it is not being
   * edited and should mirror the committed quantity.
   *
   * It lives here rather than on CartLine because the cart is what gets
   * serialised and posted, and a half-typed value is not a quantity. Nothing
   * has to clear it when the line changes from outside — re-adding the same
   * product from the search box moves focus first, and the blur handler
   * resolves the draft on the way out.
   */
  const [draft, setDraft] = useState<string | null>(null);

  const unitPrice = line.actualSellingPrice ?? line.suggestedPrice;
  const discounted =
    line.actualSellingPrice !== null &&
    line.actualSellingPrice !== line.suggestedPrice;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-950">{line.productName}</p>
          {/* Which batch, spelled out: the same product can sit on two lines at
              two prices, and the reference alone may not tell them apart. */}
          <p className="text-xs text-slate-500">
            Ref {line.batchNumber} · received{" "}
            {formatDateKey(line.batchReceivedDate)}
          </p>
          <p className="text-xs text-slate-500">
            Suggested {formatCurrency(line.suggestedPrice)} ·{" "}
            {line.quantityAvailable} left in this batch
          </p>
        </div>

        <Button variant="ghost" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {/* Keyed on the batch, not the product: two lines of the same product
            would otherwise share a DOM id and both labels would point at the
            first input. */}
        <Field label="Quantity" htmlFor={`qty-${line.stockBatchId}`}>
          <Input
            id={`qty-${line.stockBatchId}`}
            type="number"
            min={1}
            max={line.quantityAvailable}
            step={1}
            inputMode="numeric"
            value={draft ?? line.quantity}
            onChange={(event) => {
              const raw = event.target.value;

              // The field shows the draft while it is being edited, so it can
              // be emptied. Committing on every keystroke instead is what made
              // the box unclearable: Number("") is 0, not NaN, so deleting the
              // "1" clamped straight back to 1 and the next digit appended to
              // it — typing 5 gave 15.
              setDraft(raw);

              // The cart still follows along as the user types, but only while
              // the value is a legal quantity, so the estimated total never
              // shows a figure the sale could not be recorded at. Anything else
              // waits for blur. Either way this is a convenience: record_sale()
              // re-checks availability against locked rows, which is what makes
              // two tills selling the last unit safe.
              const parsed = Number(raw);

              if (
                Number.isInteger(parsed) &&
                parsed >= 1 &&
                parsed <= line.quantityAvailable
              ) {
                onChange({ quantity: parsed });
              }
            }}
            onBlur={(event) => {
              // Leaving the field resolves whatever is in it. Empty is checked
              // before parsing rather than left to Number(): Number("") is 0,
              // not NaN, so an isFinite test would treat a cleared box as a
              // real zero and only reach 1 by way of the clamp below. That is
              // the same trap that made the field unclearable to begin with.
              const raw = event.target.value.trim();
              const parsed = Number(raw);

              const quantity =
                raw === "" || !Number.isFinite(parsed)
                  ? 1
                  : Math.max(
                      1,
                      Math.min(Math.round(parsed), line.quantityAvailable),
                    );

              onChange({ quantity });
              setDraft(null);
            }}
          />
        </Field>

        <Field
          label="Price each"
          htmlFor={`price-${line.stockBatchId}`}
          hint={discounted ? "Adjusted" : "Leave blank for suggested"}
        >
          <Input
            id={`price-${line.stockBatchId}`}
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder={line.suggestedPrice.toFixed(2)}
            value={line.actualSellingPrice ?? ""}
            onChange={(event) => {
              const raw = event.target.value;

              onChange({
                actualSellingPrice:
                  raw === "" || !Number.isFinite(Number(raw))
                    ? null
                    : Number(raw),
              });
            }}
          />
        </Field>

        <div className="flex flex-col justify-end">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Line total
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-950">
            {formatCurrency(unitPrice * line.quantity)}
          </p>
        </div>
      </div>
    </div>
  );
}
