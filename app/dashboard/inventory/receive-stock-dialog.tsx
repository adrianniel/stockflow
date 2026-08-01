"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { FormAlert, SubmitButton, fieldError } from "@/components/ui/form-status";
import { Modal } from "@/components/ui/modal";
import { IDLE } from "@/lib/shop/action-result";
import { receiveStock } from "@/lib/shop/actions";
import { formatCurrency, sellingPriceFrom } from "@/lib/utils/format";

type ReceiveStockDialogProps = {
  products: Array<{ id: string; label: string }>;
  /** Shop default markup, pre-filled but editable per arrival. */
  defaultInterest: number;
  /** Pre-selected and locked when opened from a product's own page. */
  fixedProductId?: string;
  triggerLabel?: string;
};

/**
 * Records a stock arrival as a new batch (SRS 6.4).
 *
 * The selling price shown here is a preview only. The server recomputes it from
 * capital price and interest with the same rule, so the stored price cannot
 * disagree with the rule even if this form is bypassed.
 */
export function ReceiveStockDialog({
  products,
  defaultInterest,
  fixedProductId,
  triggerLabel = "Receive stock",
}: ReceiveStockDialogProps) {
  const [open, setOpen] = useState(false);
  const disabled = products.length === 0;

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={disabled}>
        {triggerLabel}
      </Button>

      <ReceiveStockForm
        // Remounting on open resets the form and clears any previous message.
        key={open ? "open" : "closed"}
        open={open}
        onClose={() => setOpen(false)}
        products={products}
        defaultInterest={defaultInterest}
        fixedProductId={fixedProductId}
      />
    </>
  );
}

function ReceiveStockForm({
  open,
  onClose,
  products,
  defaultInterest,
  fixedProductId,
}: {
  open: boolean;
  onClose: () => void;
  products: Array<{ id: string; label: string }>;
  defaultInterest: number;
  fixedProductId?: string;
}) {
  const [state, formAction] = useActionState(receiveStock, IDLE);

  // Tracked in state purely to drive the live selling-price preview.
  const [capitalPrice, setCapitalPrice] = useState("");
  const [interest, setInterest] = useState(String(defaultInterest));

  useEffect(() => {
    if (state.status === "success") {
      onClose();
    }
  }, [state, onClose]);

  const preview =
    capitalPrice.trim() === "" || Number.isNaN(Number(capitalPrice))
      ? null
      : sellingPriceFrom(Number(capitalPrice), Number(interest) || 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Receive stock"
      description="Each arrival becomes its own batch, so earlier stock keeps the price it was bought at."
    >
      <form action={formAction} className="space-y-4">
        {fixedProductId ? (
          <input type="hidden" name="product_id" value={fixedProductId} />
        ) : (
          <Field
            label="Product"
            htmlFor="batch-product"
            error={fieldError(state, "product_id")}
          >
            <Select id="batch-product" name="product_id" defaultValue="" required>
              <option value="" disabled>
                Choose a product
              </option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field
          label="Batch number"
          htmlFor="batch-number"
          error={fieldError(state, "batch_number")}
          hint="Your own reference — a delivery receipt number works well."
        >
          <Input
            id="batch-number"
            name="batch_number"
            placeholder="DR-1042"
            maxLength={60}
            required
          />
        </Field>

        <Field
          label="Quantity received"
          htmlFor="batch-quantity"
          error={fieldError(state, "quantity_received")}
        >
          <Input
            id="batch-quantity"
            name="quantity_received"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="20"
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Capital price"
            htmlFor="batch-capital"
            error={fieldError(state, "capital_price")}
            hint="Per unit, what you paid."
          >
            <Input
              id="batch-capital"
              name="capital_price"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="800.00"
              value={capitalPrice}
              onChange={(event) => setCapitalPrice(event.target.value)}
              required
            />
          </Field>

          <Field
            label="Interest %"
            htmlFor="batch-interest"
            error={fieldError(state, "interest_percentage")}
            hint="Your markup on this batch."
          >
            <Input
              id="batch-interest"
              name="interest_percentage"
              type="number"
              min={0}
              max={1000}
              step="0.01"
              inputMode="decimal"
              value={interest}
              onChange={(event) => setInterest(event.target.value)}
              required
            />
          </Field>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Selling price
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-950">
            {preview === null ? "—" : formatCurrency(preview)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Capital price plus interest. You can still discount at the till.
          </p>
        </div>

        <FormAlert state={state} />

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>

          <SubmitButton pendingLabel="Recording...">Record arrival</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
