"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormAlert, SubmitButton } from "@/components/ui/form-status";
import { Modal } from "@/components/ui/modal";
import { IDLE, type ActionState } from "@/lib/shop/action-result";

type ConfirmFormProps = {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  /** Hidden fields identifying the record, usually `{ id }`. */
  values: Record<string, string>;
  trigger: string;
  title: string;
  description: string;
  confirmLabel: string;
};

/**
 * A destructive action behind a confirmation dialog.
 *
 * Deletes here cascade — removing a product takes its stock batches with it —
 * so the description is passed in by the caller and is expected to say what
 * else goes. The dialog stays open on failure so the error is readable next to
 * the button that caused it.
 */
export function ConfirmForm({
  action,
  values,
  trigger,
  title,
  description,
  confirmLabel,
}: ConfirmFormProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, IDLE);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {trigger}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
      >
        <form action={formAction} className="space-y-4">
          {Object.entries(values).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}

          <FormAlert state={state} />

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>

            <SubmitButton variant="danger" pendingLabel="Removing...">
              {confirmLabel}
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
