"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { signIn, signOut } from "@/lib/supabase/auth";
import { errorMessage } from "@/lib/utils/errors";

type LoginForm = {
  email: string;
  password: string;
};

type LoginFormProps = {
  /**
   * Set when a route guard bounced the visitor here. Their Supabase session is
   * still valid at this point — the block comes from `users.status` or the
   * shop's status, neither of which auth knows about.
   */
  blocked?: "account" | "shop";
};

export function LoginForm({ blocked }: LoginFormProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>();

  const [formError, setFormError] = useState("");

  // A blocked visitor still holds a valid session cookie, so signing in again
  // would bounce them straight back here. Clear it once on arrival to end the
  // loop and leave the form in a state where a different account can be used.
  useEffect(() => {
    if (!blocked) {
      return;
    }

    void signOut().catch(() => {
      // Nothing useful to do: the session is already unusable for this app, and
      // the guard will keep refusing it either way.
    });
  }, [blocked]);

  async function onSubmit(data: LoginForm) {
    setFormError("");

    try {
      await signIn(data.email, data.password);

      // /dashboard resolves the role and forwards to the right home, so the
      // login page never needs to know about roles itself.
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setFormError(errorMessage(error, "Login failed"));
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mt-8 space-y-5 [&_label]:text-slate-300 [&_input]:border-white/10 [&_input]:bg-slate-900 [&_input]:text-white [&_input]:placeholder:text-slate-500"
    >
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@shop.com"
          className="focus:border-blue-400 focus:ring-blue-400/20"
          aria-invalid={errors.email ? true : undefined}
          {...register("email", { required: "Email is required" })}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={errors.password?.message}
      >
        <PasswordInput
          id="password"
          autoComplete="current-password"
          className="focus:border-blue-400 focus:ring-blue-400/20"
          aria-invalid={errors.password ? true : undefined}
          {...register("password", { required: "Password is required" })}
        />
      </Field>

      {formError ? (
        <p role="alert" className="text-sm font-medium text-rose-600">
          {formError}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
