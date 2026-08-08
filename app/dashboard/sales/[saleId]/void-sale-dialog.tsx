"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { FormAlert, SubmitButton, fieldError } from "@/components/ui/form-status";
import { Modal } from "@/components/ui/modal";
import { voidSale } from "@/lib/shop/actions";
import { IDLE } from "@/lib/shop/action-result";

type VoidSaleDialogProps = {
  saleId: string;
  /** Shown in the dialog so the owner can confirm they are cancelling the right sale. */
  summary: string;
};

/**
 * Void confirmation, with the reason typed in the dialog.
 *
 * Not `ConfirmForm`: that component only carries hidden fields, and the reason
 * is the point here. A void with no reason is a sale that vanished, which is
 * the thing this feature exists to avoid — so the field is required, both in
 * the browser and again in `void_sale()`.
 *
 * The dialog stays open on failure. "Returning 5 units to batch 080826 would
 * leave it holding more than ever arrived" is an error the owner has to act on,
 * and it belongs next to the button that produced it rather than on a page
 * they have been navigated away from.
 */
export function VoidSaleDialog({ saleId, summary }: VoidSaleDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(voidSale, IDLE);

  // Left open after a successful void so the outcome — how many units went
  // back, whether any line could not be restored — is read rather than
  // flashing past. The page behind has already revalidated.
  const done = state.status === "success";

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Void sale
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Void this sale"
        description={`${summary}. The sale stays in the history marked as voided, its stock goes back to the batches it came from, and it stops counting in every report.`}
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="sale_id" value={saleId} />

          <Field
            label="Reason"
            htmlFor="void_reason"
            error={fieldError(state, "void_reason")}
            hint="Why this sale is being cancelled — wrong item, wrong customer, cancelled order. This is kept with the sale."
          >
            <Textarea
              id="void_reason"
              name="void_reason"
              maxLength={300}
              required
              disabled={done}
              placeholder="Customer returned the item unopened"
            />
          </Field>

          <FormAlert state={state} />

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {done ? "Close" : "Cancel"}
            </Button>

            {done ? null : (
              <SubmitButton variant="danger" pendingLabel="Voiding...">
                Void sale
              </SubmitButton>
            )}
          </div>
        </form>
      </Modal>
    </>
  );
}
