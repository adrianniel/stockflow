"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FormAlert, SubmitButton, fieldError } from "@/components/ui/form-status";
import { Modal } from "@/components/ui/modal";
import { IDLE } from "@/lib/shop/action-result";
import { adjustStock } from "@/lib/shop/actions";

type Batch = {
  id: string;
  label: string;
  /** Date, price and quantity — what tells two same-named batches apart. */
  detail: string;
  quantityRemaining: number;
};

/**
 * Records a stock correction (SRS 13).
 *
 * Quantity is entered as a signed change rather than as a new total, because the
 * reason is usually "three were damaged" rather than "there are now 17". Storing
 * the delta also means the adjustment log reads as a history of events.
 */
export function AdjustStockDialog({ batches }: { batches: Batch[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={batches.length === 0}>
        New adjustment
      </Button>

      <AdjustStockForm
        key={open ? "open" : "closed"}
        open={open}
        onClose={() => setOpen(false)}
        batches={batches}
      />
    </>
  );
}

function AdjustStockForm({
  open,
  onClose,
  batches,
}: {
  open: boolean;
  onClose: () => void;
  batches: Batch[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(adjustStock, IDLE);
  const [batchId, setBatchId] = useState("");

  useEffect(() => {
    if (state.status === "success") {
      onClose();
      router.refresh();
    }
  }, [state, onClose, router]);

  const selected = batches.find((batch) => batch.id === batchId) ?? null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adjust stock"
      description="Corrections are logged with a reason and cannot be edited afterwards."
    >
      <form action={formAction} className="space-y-4">
        <Field
          label="Batch"
          htmlFor="adjust-batch"
          error={fieldError(state, "stock_batch_id")}
          hint={
            selected
              ? `${selected.label} · ${selected.detail}`
              : "Type to search by product or batch reference."
          }
        >
          <Combobox
            id="adjust-batch"
            name="stock_batch_id"
            options={batches.map((batch) => ({
              value: batch.id,
              label: batch.label,
              hint: batch.detail,
            }))}
            placeholder="Choose a batch"
            emptyLabel="No matching batch"
            invalid={Boolean(fieldError(state, "stock_batch_id"))}
            onValueChange={setBatchId}
          />
        </Field>

        <Field
          label="Quantity change"
          htmlFor="adjust-quantity"
          error={fieldError(state, "quantity_change")}
          hint="Negative to remove (damaged, missing), positive to add back."
        >
          <Input
            id="adjust-quantity"
            name="quantity_change"
            type="number"
            step={1}
            inputMode="numeric"
            placeholder="-3"
            required
          />
        </Field>

        <Field
          label="Reason"
          htmlFor="adjust-reason"
          error={fieldError(state, "reason")}
          hint="Required. This is the audit trail."
        >
          <Textarea
            id="adjust-reason"
            name="reason"
            placeholder="Three units damaged in storage."
            maxLength={300}
            required
          />
        </Field>

        <FormAlert state={state} />

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>

          <SubmitButton pendingLabel="Recording..." disabled={batchId === ""}>
            Record adjustment
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
