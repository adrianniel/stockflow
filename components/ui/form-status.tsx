"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonVariant } from "@/components/ui/button";
import type { ActionState } from "@/lib/shop/action-result";

/**
 * Submit button that disables itself while its form is in flight.
 *
 * `useFormStatus` reads the state of the nearest enclosing <form>, which is why
 * this has to be its own component rather than a prop on the form — the hook
 * returns nothing when called from the component that renders the form itself.
 * Disabling matters here beyond feedback: a double-clicked sale would otherwise
 * post twice and deduct stock twice.
 */
export function SubmitButton({
  children,
  pendingLabel = "Saving...",
  variant = "primary",
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

/**
 * Renders the result of a server action.
 *
 * `role="status"` rather than `role="alert"` for success so a screen reader
 * announces it without interrupting; errors use `alert` because the user has to
 * act on them.
 */
export function FormAlert({ state }: { state: ActionState }) {
  if (state.status === "idle") {
    return null;
  }

  const isError = state.status === "error";

  return (
    <p
      role={isError ? "alert" : "status"}
      className={
        isError
          ? "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
          : "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
      }
    >
      {state.message}
    </p>
  );
}

/** Field-level message from an action's `fieldErrors`, if it has one. */
export function fieldError(
  state: ActionState,
  field: string,
): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[field] : undefined;
}
