"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { changePassword } from "@/lib/supabase/auth";
import { errorMessage } from "@/lib/utils/errors";

type PasswordForm = {
  password: string;
  confirmPassword: string;
};

/**
 * Password change (SRS 6.1).
 *
 * Runs against the browser Supabase client rather than a server action, because
 * `auth.updateUser` acts on the session that holds the tokens. The new password
 * therefore never travels to our own server — it goes straight to Supabase over
 * TLS, which is one fewer place it could be logged.
 *
 * Uses react-hook-form rather than useActionState for the same reason: there is
 * no server action to drive.
 */
export function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>();

  const [message, setMessage] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);

  async function onSubmit(data: PasswordForm) {
    setMessage(null);

    try {
      await changePassword(data.password);

      // Cleared on success so the new password is not left sitting in the DOM.
      reset();
      setMessage({ kind: "success", text: "Password updated." });
    } catch (error) {
      setMessage({
        kind: "error",
        text: errorMessage(error, "Could not update your password."),
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-xl space-y-4"
      autoComplete="off"
    >
      <Field
        label="New password"
        htmlFor="new-password"
        error={errors.password?.message}
        hint="At least 8 characters."
      >
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          {...register("password", {
            required: "Enter a new password",
            minLength: {
              value: 8,
              message: "Use at least 8 characters",
            },
          })}
        />
      </Field>

      <Field
        label="Confirm new password"
        htmlFor="confirm-password"
        error={errors.confirmPassword?.message}
      >
        <PasswordInput
          id="confirm-password"
          autoComplete="new-password"
          {...register("confirmPassword", {
            required: "Repeat the new password",
            validate: (value) =>
              value === getValues("password") ||
              "The passwords do not match",
          })}
        />
      </Field>

      {message ? (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={
            message.kind === "error"
              ? "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
              : "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
          }
        >
          {message.text}
        </p>
      ) : null}

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Updating..." : "Update password"}
        </Button>
      </div>
    </form>
  );
}
