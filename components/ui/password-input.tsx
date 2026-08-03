"use client";

import type { ComponentPropsWithRef } from "react";
import { useState } from "react";

import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";

type PasswordInputProps = Omit<ComponentPropsWithRef<"input">, "type">;

/**
 * Password field with a show/hide toggle.
 *
 * Lives in its own file rather than in field.tsx because it needs state, and
 * field.tsx is otherwise a server-safe module of plain primitives.
 *
 * Behaviour worth knowing:
 *
 *   * Always mounts hidden. Revealing is a deliberate act each time, so a
 *     dialog reopened later never starts with a password on screen.
 *   * The toggle is a real focusable button. Putting it outside the tab order
 *     would hide the feature from anyone navigating by keyboard, which is the
 *     group least able to check what they typed by other means.
 *   * `type="button"` is load-bearing — the default inside a <form> is
 *     "submit", so without it, revealing the password would submit the form.
 *
 * Everything else is forwarded, so `autoComplete`, `required`, `minLength`,
 * `aria-invalid` and react-hook-form's `register()` spread all behave as they
 * do on a plain Input.
 */
export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        // Room for the button, so a long password never runs underneath it.
        className={cn("pr-12", className)}
      />

      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        // The label states the action, not the state, because that is what a
        // screen reader user is deciding whether to trigger.
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-2xl text-slate-400 transition hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M10.6 6.7A8.9 8.9 0 0 1 12 6.6c6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 0 1-2.9 3.6" />
      <path d="M6.7 8.2A17.4 17.4 0 0 0 3 13.1s3.5 6.5 9.5 6.5a8.8 8.8 0 0 0 3.6-.75" />
      <path d="M10.2 10.5a3 3 0 0 0 4.2 4.2" />
      <path d="m4 3.5 16 17" />
    </svg>
  );
}
