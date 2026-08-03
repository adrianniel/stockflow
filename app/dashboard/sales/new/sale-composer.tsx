"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { FormAlert, SubmitButton, fieldError } from "@/components/ui/form-status";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { IDLE } from "@/lib/shop/action-result";
import { recordSale } from "@/lib/shop/actions";
import type {
  CartLine,
  Customer,
  InventoryLine,
  PaymentStatus,
} from "@/lib/shop/types";
import { formatCurrency } from "@/lib/utils/format";

/**
 * The till: build a cart, adjust prices, take payment.
 *
 * The totals here are an estimate, and the code says so where it matters. The
 * real figures come from `record_sale()`, which walks the actual batches under
 * row locks — a line spanning two batches at different capital prices has a
 * profit this component cannot know, since it only sees the first batch's
 * price. Showing an estimated total is right for the customer conversation;
 * storing one would be wrong, so nothing computed here is submitted.
 *
 * What is submitted is the cart: product ids, quantities, and any price
 * override. The server derives everything else.
 */
export function SaleComposer({
  products,
  customers,
}: {
  products: InventoryLine[];
  customers: Customer[];
}) {
  const router = useRouter();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("PAID");
  const [customerId, setCustomerId] = useState("");
  const [state, formAction] = useActionState(recordSale, IDLE);

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
      setLines([]);
      setSearch("");
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
  }, [state, router]);

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

  function addProduct(product: InventoryLine) {
    setLines((current) => {
      const existing = current.find((line) => line.productId === product.productId);

      // Re-adding the same product bumps its quantity rather than creating a
      // second line, but never past what is actually in stock.
      if (existing) {
        return current.map((line) =>
          line.productId === product.productId
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
          quantity: 1,
          actualSellingPrice: null,
          suggestedPrice: product.currentSellingPrice ?? 0,
          quantityAvailable: product.quantityOnHand,
        },
      ];
    });

    setSearch("");
  }

  function updateLine(productId: string, changes: Partial<CartLine>) {
    setLines((current) =>
      current.map((line) =>
        line.productId === productId ? { ...line, ...changes } : line,
      ),
    );
  }

  function removeLine(productId: string) {
    setLines((current) => current.filter((line) => line.productId !== productId));
  }

  const estimatedTotal = lines.reduce(
    (total, line) =>
      total + line.quantity * (line.actualSellingPrice ?? line.suggestedPrice),
    0,
  );

  const hasLines = lines.length > 0;

  return (
    <form action={formAction} className="flex flex-col gap-6">
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

      <Panel>
        <PanelHeader
          title="Add products"
          description="Search by product name or brand. Only products with stock on hand appear."
        />

        <ProductSearch
          search={search}
          onSearchChange={setSearch}
          matches={matches}
          onSelect={addProduct}
          hasProducts={products.length > 0}
        />
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
                key={line.productId}
                line={line}
                onChange={(changes) => updateLine(line.productId, changes)}
                onRemove={() => removeLine(line.productId)}
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
                    ? "Who owes for this sale."
                    : "Add a customer on the Credit page first."
                }
              >
                <Select
                  id="sale-customer"
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  disabled={customers.length === 0}
                  required
                >
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </Select>
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
function SaleSubmit({ disabled }: { disabled: boolean }) {
  if (disabled) {
    return (
      <Button type="button" disabled>
        Record sale
      </Button>
    );
  }

  return <SubmitButton pendingLabel="Recording...">Record sale</SubmitButton>;
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

function CartRow({
  line,
  onChange,
  onRemove,
}: {
  line: CartLine;
  onChange: (changes: Partial<CartLine>) => void;
  onRemove: () => void;
}) {
  const unitPrice = line.actualSellingPrice ?? line.suggestedPrice;
  const discounted =
    line.actualSellingPrice !== null &&
    line.actualSellingPrice !== line.suggestedPrice;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-950">{line.productName}</p>
          <p className="text-xs text-slate-500">
            Suggested {formatCurrency(line.suggestedPrice)} ·{" "}
            {line.quantityAvailable} in stock
          </p>
        </div>

        <Button variant="ghost" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Quantity" htmlFor={`qty-${line.productId}`}>
          <Input
            id={`qty-${line.productId}`}
            type="number"
            min={1}
            max={line.quantityAvailable}
            step={1}
            inputMode="numeric"
            value={line.quantity}
            onChange={(event) => {
              const next = Number(event.target.value);

              // Clamped to available stock so the cart cannot be built into a
              // sale the server will refuse. record_sale() checks again anyway,
              // against the locked rows.
              onChange({
                quantity: Number.isFinite(next)
                  ? Math.max(1, Math.min(next, line.quantityAvailable))
                  : 1,
              });
            }}
          />
        </Field>

        <Field
          label="Price each"
          htmlFor={`price-${line.productId}`}
          hint={discounted ? "Adjusted" : "Leave blank for suggested"}
        >
          <Input
            id={`price-${line.productId}`}
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
